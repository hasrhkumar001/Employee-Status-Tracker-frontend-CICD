import React, { useState } from 'react';
import * as XLSX from 'xlsx';

interface ExcelRow {
  'Team': string;
  'Employee': string;
  'Question': string;
  [key: string]: string; // For date columns like '5-May', '6-May', etc.
}

interface ProcessedData {
  teamName: string;
  userName: string;
  date: string;
  responses: Array<{
    question: string;
    answer: string;
  }>;
  isLeave: boolean;
  leaveReason?: string;
}

interface UploadResponse {
  success: boolean;
  message: string;
  data?: {
    totalDataPoints: number;
    statusEntries: number;
    statusDocuments: number;
    insertedCount: number;
    modifiedCount: number;
    usersCreated?: string[];
    teamsProcessed?: string[];
    questionsProcessed?: string[];
  };
}

const ExcelUploadComponent: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [processedData, setProcessedData] = useState<ProcessedData[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus('');
      setProcessedData([]);
    }
  };

  const processExcelData = (data: ExcelRow[]): ProcessedData[] => {
    const processed: ProcessedData[] = [];
    let currentTeam = '';

    // First, extract all the data with team/user/question/date/answer structure
    const rawData: Array<{
      teamName: string;
      userName: string;
      question: string;
      date: string;
      answer: string;
    }> = [];

    data.forEach((row) => {
      // Extract team name - applies to all following rows until next team
      if (row['Team'] && row['Team'].trim() !== '') {
        currentTeam = row['Team'].trim();
      }

      // Extract user name and question
      const userName = row['Employee']?.trim();
      const question = row['Question']?.trim();

      if (userName && question && currentTeam) {
        // Get all date columns (excluding the first 3 columns: Team, Employee, Question)
        Object.keys(row).forEach((key) => {
          if (!['Team', 'Employee', 'Question'].includes(key)) {
            const answer = row[key];
            if (answer && answer.trim() !== '') {
              rawData.push({
                teamName: currentTeam,
                userName: userName,
                question: question,
                date: key, // This will be the date column header like '5-May'
                answer: answer.trim()
              });
            }
          }
        });
      }
    });

    // Now group by employee and date to create one status entry per employee per date
    const groupedData = new Map<string, ProcessedData>();

    rawData.forEach((item) => {
      const key = `${item.teamName}-${item.userName}-${item.date}`;
      
      if (!groupedData.has(key)) {
        // Check if any answer indicates leave
        const isLeave = item.answer.toLowerCase() === 'leave' || 
                       item.answer.toLowerCase() === 'absent';
        
        groupedData.set(key, {
          teamName: item.teamName,
          userName: item.userName,
          date: item.date,
          responses: [],
          isLeave: isLeave,
          leaveReason: isLeave ? item.answer : undefined
        });
      }

      const entry = groupedData.get(key)!;
      
      // If this answer indicates leave, mark the entire day as leave
      if (item.answer.toLowerCase() === 'leave' || item.answer.toLowerCase() === 'absent') {
        entry.isLeave = true;
        entry.leaveReason = item.answer;
      } else {
        // Add the question-answer pair to responses
        entry.responses.push({
          question: item.question,
          answer: item.answer
        });
      }
    });

    // Convert map to array
    processed.push(...Array.from(groupedData.values()));

    return processed;
  };

  const convertDateFormat = (dateStr: string): Date => {
    // Convert '5-May' format to proper date
    const currentYear = new Date().getFullYear();
    const [day, month] = dateStr.split('-');
    const monthMap: { [key: string]: number } = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    return new Date(currentYear, monthMap[month], parseInt(day));
  };

  const uploadToDatabase = async (processedData: ProcessedData[]): Promise<void> => {
    try {
      // Option 1: Upload JSON data
      const response = await fetch('/api/import/upload-status-json', {
        method: 'POST',
        headers: {
          
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ data: processedData }),
      });

      const result: UploadResponse = await response.json();
      
      if (result.success) {
        setUploadStatus(`✅ Successfully processed: ${result.data?.totalRecords} records, ${result.data?.insertedCount} inserted, ${result.data?.modifiedCount} modified`);
      } else {
        setUploadStatus(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('❌ Failed to upload data to database');  
    }
  };

  const uploadFileToDatabase = async (file: File): Promise<void> => {
    try {
      const formData = new FormData();
      formData.append('excelFile', file);

      const response = await fetch('/api/import/upload-status', {
        method: 'POST',
        headers: {
         'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData,
      });

      const result: UploadResponse = await response.json();
      
      if (result.success) {
        setUploadStatus(`✅ File uploaded successfully: ${result.data?.insertedCount} inserted, ${result.data?.modifiedCount} modified`);
      } else {
        setUploadStatus(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      console.error('File upload error:', error);
      setUploadStatus('❌ Failed to upload file to database');
    }
  };

  const handleDirectFileUpload = async () => {
    if (!file) {
      setUploadStatus('Please select a file first');
      return;
    }

    setLoading(true);
    setUploadStatus('Uploading file directly...');

    try {
      await uploadFileToDatabase(file);
    } catch (error) {
      console.error('Direct upload error:', error);
      setUploadStatus('❌ Error during direct file upload');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus('Please select a file first');
      return;
    }

    setLoading(true);
    setUploadStatus('Processing file...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

      const processed = processExcelData(jsonData);
      setProcessedData(processed);
      
      if (processed.length > 0) {
        setUploadStatus(`Processed ${processed.length} status entries. Uploading to database...`);
        await uploadToDatabase(processed);
      } else {
        setUploadStatus('No valid data found in the Excel file');
      }
    } catch (error) {
      console.error('File processing error:', error);
      setUploadStatus('❌ Error processing file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Upload Excel Status Data</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Excel File
        </label>
        <div className="mb-2 text-sm text-gray-600">
          <p><strong>Expected format:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li>Column A: Team (applies to all rows below until next team name)</li>
            <li>Column B: Employee</li>
            <li>Column C: Question</li>
            <li>Columns D onward: Dates (e.g., 5-May, 6-May, etc.)</li>
          </ul>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <div className="flex gap-4">
        {/* <button
          onClick={handleUpload}
          disabled={!file || loading}
          className={`px-6 py-2 rounded-md font-medium ${
            !file || loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? 'Processing...' : 'Process & Upload JSON'}
        </button> */}
        
        <button
          onClick={handleDirectFileUpload}
          disabled={!file || loading}
          className={`px-6 py-2 rounded-md font-medium ${
            !file || loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {uploadStatus && (
        <div className={`mt-4 p-3 rounded-md ${
          uploadStatus.includes('✅') 
            ? 'bg-green-100 text-green-800' 
            : uploadStatus.includes('❌')
            ? 'bg-red-100 text-red-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {uploadStatus}
        </div>
      )}

      {processedData.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Processed Data Preview (One Status Entry per Employee per Date)</h3>
          <div className="max-h-96 overflow-y-auto border rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Responses</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedData.slice(0, 10).map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.teamName}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.userName}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.date}</td>
                    <td className="px-4 py-2 text-sm">
                      {item.isLeave ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {item.leaveReason || 'Leave'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Present
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {item.isLeave ? (
                        <span className="text-gray-500">N/A (Leave)</span>
                      ) : (
                        <div className="max-w-xs">
                          {item.responses.map((response, respIndex) => (
                            <div key={respIndex} className="mb-1 text-xs">
                              <strong>{response.question}:</strong> {response.answer}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {processedData.length > 10 && (
              <div className="p-2 text-center text-sm text-gray-500">
                Showing first 10 of {processedData.length} status entries
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelUploadComponent;