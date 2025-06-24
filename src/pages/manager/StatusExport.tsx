import React, { useState, useEffect } from 'react';
import { Download, Filter, AlertCircle, Clock, CheckCircle, UserX, Edit } from 'lucide-react';
import axios from 'axios';
import { param } from 'express-validator';
import { Link } from 'react-router-dom';

interface ExportFilters {
  user?: string;
  team?: string;
  startDate?: string;
  endDate?: string;
  month?: string;
}

interface Team {
  _id: string;
  name: string;
  members?: User[];
}

interface User {
  _id: string;
  name: string;
  email: string;
  role?: string;
}

interface Question {
  _id: string;
  text: string;
}

interface StatusUpdate {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  } | null;
  team: {
    _id: string;
    name: string;
  } | null;
  date: string;
  isLeave: boolean;
  leaveReason?: string;
  responses: {
    question: {
      _id: string;
      text: string;
    } | null;
    answer: string;
  }[];
}


const formatKeyDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
};

const PreviewTable = ({ statuses, questions }: { statuses: StatusUpdate[], questions: Question[] }) => {
  const structureData = () => {
    const structured: any = {};
    const allDates = new Set<string>();

    // Add all dates from statuses
    statuses.forEach(status => {
      const date = formatKeyDate(status.date);
      allDates.add(date);
    });

    // Generate continuous date range
    const dateArray = Array.from(allDates).sort();
    if (dateArray.length > 1) {
      const startDate = new Date(dateArray[0]);
      const endDate = new Date(dateArray[dateArray.length - 1]);
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        allDates.add(formatKeyDate(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const statusMap = new Map<string, string>();

    statuses.forEach(status => {
      const teamName = status.team?.name || 'Unknown Team';
      const userName = status.user?.name || 'Unknown User';
      const date = formatKeyDate(status.date);
      const userId = status.user?._id;

      // Build status map for edit functionality
      if (userId) {
        const key = `${userId}|${date}`;
        statusMap.set(key, status._id);
      }

      // Initialize structure
      if (!structured[teamName]) structured[teamName] = {};
      if (!structured[teamName][userName]) structured[teamName][userName] = {};

      if (status.isLeave) {
        // Mark all questions as "On Leave" for this date
        questions.forEach(question => {
          if (!structured[teamName][userName][question._id]) {
            structured[teamName][userName][question._id] = {
              text: question.text,
              answers: {}
            };
          }
          structured[teamName][userName][question._id].answers[date] = 'N/A (On Leave)';
        });
      } else {
        // Process responses
        status.responses?.forEach(response => {
          if (response.question && response.question._id) {
            const qId = response.question._id;
            if (!structured[teamName][userName][qId]) {
              structured[teamName][userName][qId] = {
                text: response.question.text,
                answers: {}
              };
            }
            structured[teamName][userName][qId].answers[date] = response.answer;
          }
        });

        // Ensure all questions exist in structure
        questions.forEach(question => {
          if (!structured[teamName][userName][question._id]) {
            structured[teamName][userName][question._id] = {
              text: question.text,
              answers: {}
            };
          }
        });
      }
    });

    const sortedDates = Array.from(allDates)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return { structured, dateKeys: sortedDates, statusMap };
  };

  const { structured: structuredData, dateKeys, statusMap } = structureData();

  const calculateRowspans = () => {
    const teamRowspans: { [key: string]: number } = {};
    const userRowspans: { [key: string]: number } = {};

    Object.entries(structuredData).forEach(([teamName, users]) => {
      let teamQuestionCount = 0;
      Object.entries(users as any).forEach(([userName, questions]) => {
        const questionCount = Object.keys(questions).length;
        userRowspans[`${teamName}-${userName}`] = questionCount;
        teamQuestionCount += questionCount;
      });
      teamRowspans[teamName] = teamQuestionCount;
    });

    return { teamRowspans, userRowspans };
  };

  const { teamRowspans, userRowspans } = calculateRowspans();

  const renderTableRows = () => {
    const rows: JSX.Element[] = [];

    Object.entries(structuredData).forEach(([teamName, users]) => {
      let isFirstTeamRow = true;

      Object.entries(users as any).forEach(([userName, questions]) => {
        let isFirstUserRow = true;

        Object.entries(questions as any).forEach(([qId, qData]: [string, any]) => {
          // Get user ID for this row
          const userEntry = Object.entries(structuredData[teamName]).find(([name]) => name === userName);
          let userId: string | undefined;

          // Find userId from the statuses data
          const userStatus = statuses.find(s => s.user?.name === userName && s.team?.name === teamName);
          userId = userStatus?.user?._id;

          rows.push(
            <tr key={`${teamName}-${userName}-${qId}`} className=" ">
              {isFirstTeamRow && (
                <td
                  className="px-6 py-4 text-sm font-semibold text-gray-900 bg-white align-top text-center whitespace-nowrap  fixed-data left-0 z-30 min-w-[160px] max-w-[160px] border-r border-gray-200"
                  rowSpan={teamRowspans[teamName]}
                >
                  {teamName}
                </td>
              )}

              {isFirstUserRow && (
                <td
                  className="px-6 py-4 text-sm text-gray-900 align-top text-center whitespace-normal fixed-data left-40 z-20 bg-white border-r border-gray-200"
                  rowSpan={userRowspans[`${teamName}-${userName}`]}
                >
                  {userName}
                </td>
              )}

              <td className="px-6 py-4 text-sm text-gray-900 align-top whitespace-normal text-center fixed-data left-[320px] z-10 bg-white min-w-[256px] max-w-[256px] border-r border-gray-200">
                {qData.text}
              </td>

              {dateKeys.map((date) => {
                const answer = qData.answers[date];

                return (
                  <td
                    key={date}
                    className="p-2 text-sm text-center border border-gray-200 min-w-[200px] relative group"
                  >
                    {answer ? (
                      <span className="  text-xs font-medium text-gray-700">
                        {answer}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    {(() => {
                      if (userId) {
                        const key = `${userId}|${date}`;
                        const statusId = statusMap.get(key);
                        return statusId ? (
                          <Link
                            to={`/admin/status/${statusId}/edit`}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit"
                          >
                            <Edit size={14} color="#3b82f6" />
                          </Link>
                        ) : null;
                      }
                      return null;
                    })()}
                  </td>
                );
              })}
            </tr>
          );

          isFirstUserRow = false;
          isFirstTeamRow = false;
        });
      });
    });

    return rows;
  };

  return (
    <div className="overflow-auto max-w-full">
      <div className="relative overflow-x-auto shadow-sm rounded-lg border border-gray-300">
        <table className="min-w-full table-fixed">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider fixed-fields left-0 top-0 bg-gray-100 z-30 min-w-[160px] max-w-[160px] border-r border-gray-200"
              >
                Team
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider fixed-fields left-[160px] top-0 bg-gray-100 z-30 min-w-[160px] max-w-[160px] border-r border-gray-200"
              >
                User
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider fixed-fields left-[320px] top-0 bg-gray-100 z-30 min-w-[256px] max-w-[256px] border-r border-gray-200"
              >
                Question
              </th>
              {dateKeys.map((date) => {
                const d = new Date(date);

                return (
                  <th
                    key={date}
                    scope="col"
                    className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[120px]"
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-sm">
                        {d.getDate()} {d.toLocaleString('default', { month: 'short' })} {d.getFullYear()}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        {d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {renderTableRows()}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 px-6 py-3 text-xs text-gray-600 border-t border-gray-300 rounded-b-lg flex justify-between items-center">
        <span>
          Total: {Object.keys(structuredData).length} teams,{' '}
          {Object.values(structuredData).reduce((acc, users) => acc + Object.keys(users as any).length, 0)} users,{' '}
          {questions.length} questions
        </span>
        <span>
          {dateKeys.length > 0
            ? `History: ${dateKeys.length} days (${dateKeys[dateKeys.length - 1]} → ${dateKeys[0]})`
            : 'No data available'}
        </span>
      </div>
    </div>
  );
};

const StatusExport: React.FC = () => {
  const [filters, setFilters] = useState<ExportFilters>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [previewData, setPreviewData] = useState<StatusUpdate[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const teamsPerPage = 4;
  const uniqueTeamNames = Array.from(new Set(previewData.map(status => status.team?.name || 'Unknown Team')));
  const totalPages = Math.ceil(uniqueTeamNames.length / teamsPerPage);

  const currentTeams = uniqueTeamNames.slice(
    (currentPage - 1) * teamsPerPage,
    currentPage * teamsPerPage
  );

  const currentRecords = previewData.filter(status =>
    currentTeams.includes(status.team?.name || 'Unknown Team')
  );

  

  // Enhanced pagination function
  const renderPaginationNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than or equal to maxVisiblePages
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage, endPage;

      if (currentPage <= 3) {
        // Show first 4 pages + ellipsis + last page
        startPage = 1;
        endPage = 4;
      } else if (currentPage >= totalPages - 2) {
        // Show first page + ellipsis + last 4 pages
        startPage = totalPages - 3;
        endPage = totalPages;
      } else {
        // Show current page with 2 pages on each side
        startPage = currentPage - 2;
        endPage = currentPage + 2;
      }

      // Add first page if not already included
      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) {
          pageNumbers.push('...');
        }
      }

      // Add the range of pages
      for (let i = startPage; i <= endPage; i++) {
        if (i > 0 && i <= totalPages) {
          pageNumbers.push(i);
        }
      }

      // Add last page if not already included
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageNumbers.push('...');
        }
        pageNumbers.push(totalPages);
      }
    }

    return pageNumbers.map((pageNum, index) => {
      if (pageNum === '...') {
        return (
          <span key={`ellipsis-${index}`} className="px-3 py-1 text-gray-500">
            ...
          </span>
        );
      }

      return (
        <button
          key={pageNum}
          onClick={() => setCurrentPage(pageNum)}
          className={`px-3 py-1 border rounded transition-colors ${currentPage === pageNum
            ? 'bg-blue-500 text-white border-blue-500'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
        >
          {pageNum}
        </button>
      );
    });
  };

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        setDataLoading(true);
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('No authentication token found');
        }

        const teamsRes = await axios.get('/api/teams', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const fetchedTeams = teamsRes.data;
        const teamsWithMembers: Team[] = [];
        const allUsers = new Map();

        for (const team of fetchedTeams) {
          try {
            const membersRes = await axios.get(`/api/teams/${team._id}/members`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const teamMembers = membersRes.data.map((member: any) => ({
              _id: member._id,
              name: member.name,
              email: member.email,
              role: member.role,
            }));

            teamsWithMembers.push({
              ...team,
              members: teamMembers,
            });

            teamMembers.forEach((member: User) => {
              allUsers.set(member._id, member);
            });
          } catch (memberErr: any) {
            console.warn(`Error fetching members for team ${team.name}:`, memberErr);
            teamsWithMembers.push({ ...team, members: [] });
          }
        }

        setTeams(teamsWithMembers);
        setUsers(Array.from(allUsers.values()));
      } catch (err: any) {
        console.error('Error fetching dropdown data:', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch data');
      } finally {
        setDataLoading(false);
      }
    };

    fetchDropdownData();
  }, []);

  const getFilteredUsers = (): User[] => {
    if (!filters.team) {
      return users;
    }
    const selectedTeam = teams.find((team) => team._id === filters.team);
    return selectedTeam?.members?.length ? selectedTeam.members : [];
  };

  const handleTeamChange = (teamId: string) => {
    setFilters({
      ...filters,
      team: teamId || undefined,
      user: undefined, // Reset user filter when team changes
    });
    setCurrentPage(1); // Reset to first page when filter changes
    setExportError(null);
  };

  const buildQueryParams = () => {
    const params: any = {};

    if (filters.team) {
      params.teams = filters.team;
    } else if (teams.length > 0) {
      params.teams = teams.map((team) => team._id).join(',');
    }

    if (filters.user) {
      params.user = filters.user;
    }
    else if (filters.team) {
      const filteredUsers = getFilteredUsers();
      if (filteredUsers.length > 0) {
        params.users = filteredUsers.map((user) => user._id).join(',');
      }
    }

    if (filters.month) {
      const [year, month] = filters.month.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 2);
      const endDate = new Date(parseInt(year), parseInt(month), 1);
      params.startDate = startDate.toISOString().split('T')[0];
      params.endDate = endDate.toISOString().split('T')[0];

    } else if (filters.startDate && filters.endDate) {
      params.startDate = filters.startDate;
      params.endDate = filters.endDate;
    }
    else if (filters.startDate) {
      params.startDate = filters.startDate;
    }
    else if (filters.endDate) {
      params.endDate = filters.endDate;
    }

    return params;
  };

  useEffect(() => {
    const fetchPreviewData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token || teams.length === 0 || users.length === 0) return;

        const params = buildQueryParams();
        const response = await axios.get('/api/status', {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        const statusesData = response.data;

        // Filter out any invalid status entries
        const validStatuses = statusesData.filter((status: StatusUpdate) => {
          if (!status || !status._id) {
            console.warn('Invalid status entry found:', status);
            return false;
          }
          return true;
        });

        setPreviewData(validStatuses);
        setCurrentPage(1); // Reset to first page when data changes

        // Extract unique questions from all statuses
        const uniqueQuestions: Question[] = [];
        const questionMap = new Map();

        validStatuses.forEach((status: StatusUpdate) => {
          if (status.responses && Array.isArray(status.responses)) {
            status.responses.forEach(response => {
              if (response.question && response.question._id && !questionMap.has(response.question._id)) {
                questionMap.set(response.question._id, response.question);
                uniqueQuestions.push(response.question);
              }
            });
          }
        });

        setQuestions(uniqueQuestions);
      } catch (err: any) {
        console.error('Error fetching preview data:', err);
        setError(`Error fetching preview data: ${err.response?.data?.message || err.message}`);
      }
    };

    if (teams.length > 0 && users.length > 0) {
      fetchPreviewData();
    }
  }, [filters, teams, users]);

  const handleExport = async () => {
    try {
      setLoading(true);
      setExportError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      let params = buildQueryParams();

      if (!filters.month && !filters.startDate && !filters.endDate) {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, currentDate.getMonth() + 1, 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const response = await axios.get('/api/reports/excel', {
        headers: { Authorization: `Bearer ${token}` },
        params,
        responseType: 'blob',
        timeout: 30000,
      });

      if (!(response.data instanceof Blob)) {
        throw new Error('Invalid response format received');
      }

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;

      let filename = 'status-report';
      if (filters.team) {
        const teamName = teams.find((t) => t._id === filters.team)?.name || 'team';
        filename += `-${teamName.toLowerCase().replace(/\s+/g, '-')}`;
      } else {
        filename += '-all-teams';
      }

      if (filters.user) {
        const userName = getFilteredUsers().find((u) => u._id === filters.user)?.name || 'user';
        filename += `-${userName.toLowerCase().replace(/\s+/g, '-')}`;
      } else {
        filename += '-all-users';
      }

      if (filters.month) {
        filename += `-${filters.month}`;
      } else if (filters.startDate && filters.endDate) {
        filename += `-${filters.startDate}-to-${filters.endDate}`;
      } else {
        const currentDate = new Date();
        filename += `-${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      }

      filename += '.xlsx';
      link.setAttribute('download', filename);

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      let errorMessage = 'Failed to export report';
      if (err.response) {
        if (err.response.status === 403) {
          errorMessage = 'You do not have permission to export this report';
        } else if (err.response.status === 404) {
          errorMessage = 'No data found for the selected criteria';
        } else if (err.response.status === 500) {
          errorMessage = 'Server error occurred while generating report';
        } else if (err.response.data) {
          errorMessage = err.response.data.message || 'Failed to export report';
        }
      } else if (err.request) {
        errorMessage = 'Network error - please check your connection';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setExportError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setCurrentPage(1); // Reset to first page when clearing filters
    setExportError(null);
  };

  if (dataLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const filteredUsers = getFilteredUsers();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Export Status Reports</h1>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Export Filters</h2>
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label htmlFor="team" className="block text-sm font-medium text-gray-700">
                  Team
                </label>
                <select
                  id="team"
                  name="team"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={filters.team || ''}
                  onChange={(e) => handleTeamChange(e.target.value)}
                >
                  <option value="">All Teams</option>
                  {teams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="user" className="block text-sm font-medium text-gray-700">
                  User {filters.team && <span className="text-xs text-gray-500 ml-1">(from selected team)</span>}
                </label>
                <select
                  id="user"
                  name="user"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={filters.user || ''}
                  onChange={(e) => {
                    setFilters({ ...filters, user: e.target.value || undefined });
                    setCurrentPage(1); // Reset to first page when filter changes
                  }}
                >
                  <option value="">
                    {filters.team
                      ? `All Users from ${teams.find((t) => t._id === filters.team)?.name || 'Selected Team'}`
                      : 'All Users'}
                  </option>
                  {filteredUsers.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="month" className="block text-sm font-medium text-gray-700">
                  Month
                </label>
                <input
                  type="month"
                  id="month"
                  name="month"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={filters.month || ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      month: e.target.value || undefined,
                      startDate: undefined,
                      endDate: undefined,
                    })
                  }
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      name="startDate"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={filters.startDate || ''}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          startDate: e.target.value || undefined,
                          month: undefined,
                        })
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="endDate"
                      name="endDate"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={filters.endDate || ''}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          endDate: e.target.value || undefined,
                          month: undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {exportError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">Export Error: {exportError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  Export Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Preview ({previewData.length} records)
        </h2>

        {previewData.length > 0 ? (
          <>
            <PreviewTable statuses={currentRecords} questions={questions} />
            {previewData.length > teamsPerPage && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Showing {currentTeams.length} of {uniqueTeamNames.length} teams. Export will include all teams.
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex justify-center items-center mt-4 space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {renderPaginationNumbers()}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {teams.length > 0 && users.length > 0
              ? 'No data found for the selected criteria'
              : 'Loading data...'}
          </div>
        )}
      </div>

      {/* <div className="bg-white shadow-sm rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Status Types:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                  Active
                </span>
                Regular status updates with question responses
              </li>
              <li className="flex items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mr-2">
                  Leave
                </span>
                Leave entries with optional reason
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Excel Format:</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>&bull; Each row represents a user's response to a specific question</li>
              <li>&bull; Leave entries are highlighted in orange</li>
              <li>&bull; Data is organized by Team &rarr; User &rarr; Question</li>
              <li>&bull; Dates are displayed as columns for easy comparison</li>
            </ul>
          </div>
        </div>
      </div> */}
    </div>
  );
};

export default StatusExport;