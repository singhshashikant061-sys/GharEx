const API_BASE = "";

const fetchAdminRequests = async () => {
  const response = await fetch(`${API_BASE}/api/admin/requests`, {
    headers: {
      "x-admin-key": "change-this-admin-key"
    }
  });

  if (!response.ok) {
    throw new Error("Admin API is not available");
  }

  return response.json();
};

const initAdminDashboard = async () => {
  try {
    const data = await fetchAdminRequests();
    console.log("Admin dashboard loaded", data.requests?.length ?? 0);
  } catch (error) {
    console.log("Admin dashboard offline", error.message);
  }
};

window.addEventListener("DOMContentLoaded", initAdminDashboard);
