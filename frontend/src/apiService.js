const BASE_URL = 'http://localhost:5000/api';

// Helper to handle standard API responses
const handleResponse = async (response) => {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody.error || response.statusText;
        throw new Error(`API Request Failed (${response.status}): ${errorMessage}`);
    }
    if (response.status === 204) {
        return null;   // ✅ No content
    }
    return response.json();
};

const getAuthToken = () => {
  const session = localStorage.getItem('unitedpanel_session') || sessionStorage.getItem('unitedpanel_session');
  if (session) {
    try {
      const { token } = JSON.parse(session);
      return token;
    } catch { return null; }
  }
  return null;
};

export const getCurrentUser = () => {
  const session = localStorage.getItem('unitedpanel_session') || sessionStorage.getItem('unitedpanel_session');
  if (session) {
    try {
      const parsed = JSON.parse(session);
      // adjust this line to match your actual session shape
      return parsed.user || parsed;
    } catch { return null; }
  }
  return null;
};

export const getUserPosition = () => {
  const user = getCurrentUser();
  return user?.position || user?.role || null;
};

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;

    const headers = {
        ...options.headers,
    };

    if (!options.skipAuth) {
        const token = getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    const fetchOptions = {
        method: options.method || 'GET',
        headers,
        body: options.body,
    };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        if (options.body) {
            fetchOptions.body = JSON.stringify(options.body);
        }
    }

    try {
        const response = await fetch(url, fetchOptions);

        if (response.status === 204) {
            return null;
        }

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error || data.message || response.statusText;
            throw new Error(errorMessage);
        }

        return data;
    } catch (error) {
        console.error(`API request failed: ${url}`, error);
        throw error;
    }
};

// =========================================================
// PROJECTS API (Standard User/Public)
// =========================================================

export const authAPI = {
    login: (credentials) => apiRequest('/auth/login', {
        method: 'POST',
        body: credentials,
        skipAuth: true,
    }),
    register: (userData) => apiRequest('/auth/register', {
        method: 'POST',
        body: userData,
        skipAuth: true,
    }),
};
export const projectsAPI = {
    getAll: () => apiRequest('/projects'),
    getByStatus: (status) => apiRequest(`/projects/status/${status}`),
    create: (projectData) => apiRequest('/projects', {
        method: 'POST',
        body: projectData,
    }),
    update: (projectId, projectData) => apiRequest(`/projects/${projectId}`, {
        method: 'PUT',
        body: projectData,
    }),
    delete: (projectId) => apiRequest(`/projects/${projectId}`, {
        method: 'DELETE',
    }),
    updateStatus: (projectId, statusData) => apiRequest(`/projects/${projectId}/status`, {
        method: 'PATCH',
        body: statusData,
    }),
    getStatusCounts: () => apiRequest('/projects/status/counts'),

    uploadFiles: async (projectNo, filesToUpload) => {
        const formData = new FormData();
        formData.append('projectNo', projectNo);
        filesToUpload.forEach(file => formData.append('files', file));

        const response = await fetch(`${BASE_URL}/projects/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${errorText || response.statusText}`);
        }

        return response.json();
    },

    deleteFile: (fileId) => apiRequest(`/projects/file/${fileId}`, {
        method: 'DELETE',
    }),

    getFilesMetadata: (projectNo) => apiRequest(`/projects/files/${projectNo}`),

    downloadFileBlob: async (fileId) => {
        const response = await fetch(`${BASE_URL}/projects/file/blob/${fileId}`);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        return response;
    },
};

// =========================================================
// PANEL TASKS API – UPDATED WITH CORRECT DELETE ENDPOINTS
// =========================================================

export const panelTasksAPI = {
    getAll: () => apiRequest('/panel-tasks'),
    create: (taskData) => apiRequest('/panel-tasks', {
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/panel-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/panel-tasks/${taskId}`, { method: 'DELETE' }),

    // ----- Signature 1 (use /signature1) -----
    uploadSignature1: (taskId, formData) => apiRequest(`/panel-tasks/${taskId}/signature1`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature1: (taskId) => apiRequest(`/panel-tasks/${taskId}/signature1`, {
        method: 'DELETE',
    }),

    // ----- Signature 2 (use /signature2) -----
    uploadSignature2: (taskId, formData) => apiRequest(`/panel-tasks/${taskId}/signature2`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature2: (taskId) => apiRequest(`/panel-tasks/${taskId}/signature2`, {
        method: 'DELETE',
    }),

    // ----- Image -----
    uploadImage: (taskId, formData) => apiRequest(`/panel-tasks/${taskId}/image`, {
        method: 'POST',
        body: formData,
    }),
    deleteImage: (taskId) => apiRequest(`/panel-tasks/${taskId}/image`, {
        method: 'DELETE',
    }),

    // ----- Media (both signature1 + image) -----
    uploadMedia: (taskId, formData) => apiRequest(`/panel-tasks/${taskId}/media`, {
        method: 'POST',
        body: formData,
    }),
    getFiles: (taskId) => apiRequest(`/panel-tasks/${taskId}/files`),
};

// --- Door Tasks API ---
export const doorTasksAPI = {
    getAll: () => apiRequest('/door-tasks'),
    getItems: (taskId) => apiRequest(`/door-tasks/${taskId}/items`),
    saveItems: (taskId, items) => apiRequest(`/door-tasks/${taskId}/items`, {
        method: 'POST',
        body: { items },
    }),
    toggleItemCheck: (taskId, inventoryId, isChecked) => {
        return apiRequest(`/door-tasks/${taskId}/items/${inventoryId}/check`, {
            method: 'PATCH',
            body: { is_checked: isChecked },
        });
    },
    deleteItem: (taskId, inventoryId) => apiRequest(`/door-tasks/${taskId}/items/${inventoryId}`, {
        method: 'DELETE',
    }),
    create: (taskData) => apiRequest('/door-tasks', {
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/door-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/door-tasks/${taskId}`, { method: 'DELETE' }),
    uploadMedia: (taskId, formData) => apiRequest(`/door-tasks/${taskId}/media`, {
        method: 'POST',
        body: formData,
    }),
      uploadSignature1: (taskId, formData) => apiRequest(`/door-tasks/${taskId}/signature1`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature1: (taskId) => apiRequest(`/door-tasks/${taskId}/signature1`, {
        method: 'DELETE',
    }),
    uploadSignature2: (taskId, formData) => apiRequest(`/door-tasks/${taskId}/signature2`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature2: (taskId) => apiRequest(`/door-tasks/${taskId}/signature2`, {
        method: 'DELETE',
    }),
    uploadImage: (taskId, formData) => apiRequest(`/door-tasks/${taskId}/image`, {
        method: 'POST',
        body: formData,
    }),
    deleteImage: (taskId) => apiRequest(`/door-tasks/${taskId}/image`, {
        method: 'DELETE',
    }),
    getFiles: (taskId) => apiRequest(`/door-tasks/${taskId}/files`),
    downloadFileBlob: async (fileId) => {
        const response = await fetch(`${BASE_URL}/projects/file/blob/${fileId}`);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        return response;
    },
};

// --- Accessories Tasks API ---
export const accessoriesTasksAPI = {
    getAll: () => apiRequest('/accessories-tasks'),
    create: (taskData) => apiRequest('/accessories-tasks', {
        method: 'POST',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/accessories-tasks/${taskId}`, {
        method: 'DELETE',
    }),
    update: (taskId, taskData) => apiRequest(`/accessories-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    uploadMedia: (taskId, formData) => apiRequest(`/accessories-tasks/${taskId}/media`, {
        method: 'POST',
        body: formData,
    }),
      uploadSignature1: (taskId, formData) => apiRequest(`/accessories-tasks/${taskId}/signature1`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature1: (taskId) => apiRequest(`/accessories-tasks/${taskId}/signature1`, {
        method: 'DELETE',
    }),
    uploadSignature2: (taskId, formData) => apiRequest(`/accessories-tasks/${taskId}/signature2`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature2: (taskId) => apiRequest(`/accessories-tasks/${taskId}/signature2`, {
        method: 'DELETE',
    }),
    uploadImage: (taskId, formData) => apiRequest(`/accessories-tasks/${taskId}/image`, {
        method: 'POST',
        body: formData,
    }),
    deleteImage: (taskId) => apiRequest(`/accessories-tasks/${taskId}/image`, {
        method: 'DELETE',
    }),
    getFiles: (taskId) => apiRequest(`/accessories-tasks/${taskId}/files`),
    downloadFileBlob: async (fileId) => {
        const response = await fetch(`${BASE_URL}/projects/file/blob/${fileId}`);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        return response;
    },
};

// --- Cutting Tasks API (includes file methods) ---
// --- Cutting Tasks API (includes file methods) ---
export const cuttingTasksAPI = {
    getAll: () => apiRequest('/cutting-tasks'),
    create: (taskData) => apiRequest('/cutting-tasks', {
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/cutting-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/cutting-tasks/${taskId}`, { method: 'DELETE' }),
    uploadMedia: (taskId, formData) => apiRequest(`/cutting-tasks/${taskId}/media`, {
        method: 'POST',
        body: formData,
    }),
    uploadSignature1: (taskId, formData) => apiRequest(`/cutting-tasks/${taskId}/signature1`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature1: (taskId) => apiRequest(`/cutting-tasks/${taskId}/signature1`, {
        method: 'DELETE',
    }),
    uploadSignature2: (taskId, formData) => apiRequest(`/cutting-tasks/${taskId}/signature2`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature2: (taskId) => apiRequest(`/cutting-tasks/${taskId}/signature2`, {
        method: 'DELETE',
    }),
    uploadImage: (taskId, formData) => apiRequest(`/cutting-tasks/${taskId}/image`, {
        method: 'POST',
        body: formData,
    }),
    deleteImage: (taskId) => apiRequest(`/cutting-tasks/${taskId}/image`, {
        method: 'DELETE',
    }),
    // ----- File attachment endpoints (updated for your schema) -----
    getFiles: (taskId) => apiRequest(`/cutting-tasks/${taskId}/files`),
    downloadFileBlob: async (fileId) => {
        const response = await fetch(`${BASE_URL}/projects/file/blob/${fileId}`);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        return response;
    },
};

export const stripCurtainTasksAPI = {
    getAll: () => apiRequest('/strip-curtain-tasks'),
    create: (taskData) => apiRequest('/strip-curtain-tasks', {
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/strip-curtain-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/strip-curtain-tasks/${taskId}`, { method: 'DELETE' }),
    uploadMedia: (taskId, formData) => apiRequest(`/strip-curtain-tasks/${taskId}/media`, {
        method: 'POST',
        body: formData,
    }),
};

export const systemTasksAPI = {
    getAll: () => apiRequest('/system-tasks'),
    create: (taskData) => apiRequest('/system-tasks', {
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/system-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/system-tasks/${taskId}`, { method: 'DELETE' }),
    uploadMedia: (taskId, formData) => apiRequest(`/system-tasks/${taskId}/media`, {
        method: 'POST',
        body: formData,
    }),
       uploadSignature1: (taskId, formData) => apiRequest(`/system-tasks/${taskId}/signature1`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature1: (taskId) => apiRequest(`/system-tasks/${taskId}/signature1`, {
        method: 'DELETE',
    }),
    uploadSignature2: (taskId, formData) => apiRequest(`/system-tasks/${taskId}/signature2`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature2: (taskId) => apiRequest(`/system-tasks/${taskId}/signature2`, {
        method: 'DELETE',
    }),
    uploadImage: (taskId, formData) => apiRequest(`/system-tasks/${taskId}/image`, {
        method: 'POST',
        body: formData,
    }),
    deleteImage: (taskId) => apiRequest(`/system-tasks/${taskId}/image`, {
        method: 'DELETE',
    }),
    getFiles: (taskId) => apiRequest(`/system-tasks/${taskId}/files`),
    downloadFileBlob: async (fileId) => {
        const response = await fetch(`${BASE_URL}/projects/file/blob/${fileId}`);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        return response;
    },
};

export const projectAdminAPI = {
    getAllProjects: () => apiRequest('/admin/projects'),
    createProject: (projectData) => apiRequest('/admin/projects', {
        method: 'POST',
        body: projectData,
    }),
    getProjectByJobNo: (jobNo) => apiRequest(`/admin/projects/${jobNo}`),
    updateProject: (jobNo, projectData) => apiRequest(`/admin/projects/${jobNo}`, {
        method: 'PUT',
        body: projectData,
    }),
    deleteProject: (jobNo) => apiRequest(`/admin/projects/${jobNo}`, {
        method: 'DELETE',
    }),
};

export const jobAdminAPI = {
    getAllJobs: () => apiRequest('/admin/projects'),
    createJob: (jobData) => apiRequest('/admin/projects', {
        method: 'POST',
        body: jobData,
    }),
    getJobByJobNo: (jobNo) => apiRequest(`/admin/projects/${jobNo}`),
    updateJob: (jobNo, jobData) => apiRequest(`/admin/projects/${jobNo}`, {
        method: 'PUT',
        body: jobData,
    }),
    deleteJob: (jobNo) => apiRequest(`/admin/projects/${jobNo}`, {
        method: 'DELETE',
    }),
};

export const activityLogsAPI = {
    getAll: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/activity-logs?${queryString}` : '/activity-logs';
        return apiRequest(endpoint);
    },
};

export const transportationTasksAPI = {
    getAll: () => apiRequest('/transportation-tasks'),
    create: (taskData) => apiRequest('/transportation-tasks', {
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/transportation-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/transportation-tasks/${taskId}`, { method: 'DELETE' }),

    // ----- Signature 1 -----
    uploadSignature1: (taskId, formData) => apiRequest(`/transportation-tasks/${taskId}/signature1`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature1: (taskId) => apiRequest(`/transportation-tasks/${taskId}/signature1`, {
        method: 'DELETE',
    }),

    // ----- Signature 2 -----
    uploadSignature2: (taskId, formData) => apiRequest(`/transportation-tasks/${taskId}/signature2`, {
        method: 'POST',
        body: formData,
    }),
    deleteSignature2: (taskId) => apiRequest(`/transportation-tasks/${taskId}/signature2`, {
        method: 'DELETE',
    }),

    // ----- Image -----
    uploadImage: (taskId, formData) => apiRequest(`/transportation-tasks/${taskId}/image`, {
        method: 'POST',
        body: formData,
    }),
    deleteImage: (taskId) => apiRequest(`/transportation-tasks/${taskId}/image`, {
        method: 'DELETE',
    }),

    // ----- Legacy media (signature1 + image) -----
    uploadMedia: (taskId, formData) => apiRequest(`/transportation-tasks/${taskId}/media`, {
        method: 'POST',
        body: formData,
    }),

    // ----- File attachments -----
    getFiles: (taskId) => apiRequest(`/transportation-tasks/${taskId}/files`),
    downloadFileBlob: async (fileId) => {
        const response = await fetch(`${BASE_URL}/projects/file/blob/${fileId}`);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        return response;
    },

    // ----- Create transportation from panel task (if needed) -----
    createFromPanelTask: (panelTaskId) =>
        apiRequest(`/panel-tasks/${panelTaskId}/transportation`, { method: 'POST' }),
};

export const viewPanelAPI = {
    getAll: () => apiRequest('/panels'),
    getById: (panelId) => apiRequest(`/panels/${panelId}`),
    create: (panelData) => apiRequest('/panels', {
        method: 'POST',
        body: panelData,
    }),
    update: (id, data) => {
        const formattedData = { ...data };
        if (formattedData.estimated_delivery) {
            const date = new Date(formattedData.estimated_delivery);
            if (!isNaN(date.getTime())) {
                formattedData.estimated_delivery = date.toISOString().split('T')[0];
            }
        }
        return apiRequest(`/panels/${id}`, {
            method: 'PUT',
            body: formattedData,
        });
    },
    delete: (panelId) => apiRequest(`/panels/${panelId}`, { method: 'DELETE' }),
    deleteByJob: (jobNo) => apiRequest(`/panels/by-job/${encodeURIComponent(jobNo)}`, { method: 'DELETE' }),
    getProductionSummary: (panelId) => apiRequest(`/panels/${panelId}/production-summary`),
    createProductionWithBalance: (panelId, productionData) => apiRequest(`/panels/${panelId}/production-with-balance`, {
        method: 'POST',
        body: productionData,
    }),
    deleteProductionWithBalance: (panelId, recordId) => apiRequest(`/panels/${panelId}/production/${recordId}/with-balance`, {
        method: 'DELETE',
    }),
    duplicate: (panelId) => apiRequest(`/panels/${panelId}/duplicate`, { method: 'POST' }),
    getBalanceHistory: (panelId) => apiRequest(`/panels/${panelId}/balance-history`),
    updateBalance: (panelId, balanceData) => apiRequest(`/panels/${panelId}/balance`, {
        method: 'PUT',
        body: balanceData,
    }),
    getStatsSummary: () => apiRequest('/panels/stats/summary'),
};

export const stockAPI = {
    getAll: () => apiRequest('/stock'),
    create: (data) => apiRequest('/stock', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/stock/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/stock/${id}`, { method: 'DELETE' }),
};

export const productionAPI = {
    getByPanelId: (panelId) => apiRequest(`/panels/${panelId}/production-records`),
    create: (panelId, productionData) => apiRequest(`/panels/${panelId}/production-records`, {
        method: 'POST',
        body: productionData,
    }),
    getAll: () => apiRequest('/panels/production-records/all'),
    getByDate: (date) => apiRequest(`/panels/production-records/by-date?date=${date}`),
    update: (panelId, recordId, productionData) => apiRequest(`/panels/${panelId}/production-records/${recordId}`, {
        method: 'PUT',
        body: productionData,
    }),
    updateStatus: (recordId, statusData) => apiRequest(`/panels/production-records/${recordId}/status`, {
        method: 'PATCH',
        body: statusData,
    }),
    delete: (panelId, recordId) => apiRequest(`/panels/${panelId}/production-records/${recordId}`, {
        method: 'DELETE',
    }),
};

export const aiAPI = {
    chat: async (message, sessionId) => {
        return apiRequest('/ai/chat', {
            method: 'POST',
            body: { message, sessionId },
        });
    },
    generateProjects: async (prompt) => {
        return apiRequest('/ai/generate-projects', {
            method: 'POST',
            body: { prompt },
        });
    },
    createFromAI: async (projects) => {
        return apiRequest('/ai/create-from-ai', {
            method: 'POST',
            body: { projects },
        });
    },
    askQuestion: async (question, sessionId) => {
        return apiRequest('/ai/ask', {
            method: 'POST',
            body: { question, sessionId },
        });
    },
    chatStream: async (message, sessionId, onChunk, onDone, onError) => {
        try {
            const response = await fetch(`${BASE_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, sessionId }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullMessage = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'chunk') {
                                fullMessage += data.data;
                                onChunk(fullMessage);
                            } else if (data.type === 'done') {
                                onDone(fullMessage, data.isMutation);
                                return;
                            } else if (data.type === 'error') {
                                onError(data.error);
                                return;
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', e);
                        }
                    }
                }
            }
        } catch (err) {
            onError(err.message);
        }
    },
};

export const inventoryAPI = {
    getAll: () => apiRequest('/inventory'),
    get: (id) => apiRequest(`/inventory/${id}`),
    create: (data) => apiRequest('/inventory', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/inventory/${id}`, { method: 'PUT', body: data }),
    patchQuantity: (id, payload) => apiRequest(`/inventory/${id}/quantity`, { method: 'PATCH', body: payload }),
    delete: (id) => apiRequest(`/inventory/${id}`, { method: 'DELETE' }),
    uploadMedia: (id, formData) => apiRequest(`/inventory/${id}/media`, {
        method: 'POST',
        body: formData,
    }),
    deleteImage: (id) => apiRequest(`/inventory/${id}/image`, { method: 'DELETE' }),
    deleteSignature: (id) => apiRequest(`/inventory/${id}/signature`, { method: 'DELETE' }),
};

// =========================================================
// LEGACY NAMED EXPORTS (for backward compatibility)
// =========================================================

export const getAllProjects = projectsAPI.getAll;
export const createProject = projectsAPI.create;
export const updateProject = projectsAPI.update;
export const deleteProject = projectsAPI.delete;
export const uploadProjectFiles = projectsAPI.uploadFiles;
export const deleteProjectFile = projectsAPI.deleteFile;
export const getProjectFilesMetadata = projectsAPI.getFilesMetadata;
export const downloadFileBlob = projectsAPI.downloadFileBlob;
export const updateProjectStatus = projectsAPI.updateStatus;
export const getProjectStatusCounts = projectsAPI.getStatusCounts;
export const getProjectsByStatus = projectsAPI.getByStatus;

export const getAllPanelTasks = panelTasksAPI.getAll;
export const createPanelTask = panelTasksAPI.create;
export const updatePanelTask = panelTasksAPI.update;
export const deletePanelTask = panelTasksAPI.delete;

export const getAllDoorTasks = doorTasksAPI.getAll;
export const createDoorTask = doorTasksAPI.create;
export const updateDoorTask = doorTasksAPI.update;
export const deleteDoorTask = doorTasksAPI.delete;

export const getAllCuttingTasks = cuttingTasksAPI.getAll;
export const createCuttingTask = cuttingTasksAPI.create;
export const updateCuttingTask = cuttingTasksAPI.update;
export const deleteCuttingTask = cuttingTasksAPI.delete;

export const getAllAccessoriesTasks = accessoriesTasksAPI.getAll;
export const createAccessoriesTask = accessoriesTasksAPI.create;
export const updateAccessoriesTask = accessoriesTasksAPI.update;
export const deleteAccessoriesTask = accessoriesTasksAPI.delete;

export const getAllStripCurtainTasks = stripCurtainTasksAPI.getAll;
export const createStripCurtainTask = stripCurtainTasksAPI.create;
export const updateStripCurtainTask = stripCurtainTasksAPI.update;
export const deleteStripCurtainTask = stripCurtainTasksAPI.delete;

export const getAllSystemTasks = systemTasksAPI.getAll;
export const createSystemTask = systemTasksAPI.create;
export const updateSystemTask = systemTasksAPI.update;
export const deleteSystemTask = systemTasksAPI.delete;

export const getAllAdminJobs = jobAdminAPI.getAllJobs;
export const createAdminJob = jobAdminAPI.createJob;
export const updateAdminJob = jobAdminAPI.updateJob;
export const deleteAdminJob = jobAdminAPI.deleteJob;
export const getAdminJobByJobNo = jobAdminAPI.getJobByJobNo;

export const getAllActivityLogs = activityLogsAPI.getAll;

export const getAllTransportationTasks = transportationTasksAPI.getAll;
export const createTransportationTask = transportationTasksAPI.create;
export const updateTransportationTask = transportationTasksAPI.update;
export const deleteTransportationTask = transportationTasksAPI.delete;

export const getAllPanels = viewPanelAPI.getAll;
export const getPanelById = viewPanelAPI.getById;
export const createPanel = viewPanelAPI.create;
export const updatePanel = viewPanelAPI.update;
export const deletePanel = viewPanelAPI.delete;