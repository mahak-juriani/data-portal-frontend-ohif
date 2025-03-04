const mockDatabase = JSON.parse(localStorage.getItem('mockDatabase')) || {
  mammo: {},
  gbc: {},
};

const mockApi = {
  saveGroundTruth: async (studyInstanceUid, category, data) => {
    console.log(`💾 Mock API: Saving Ground Truth for ${category} - ${studyInstanceUid}`);
    console.log('📌 Data received in mock API:', data);

    if (!category) {
      console.error('❌ ERROR: category is undefined!');
      return { success: false, message: 'Invalid category' };
    }

    if (!mockDatabase[category]) {
      console.warn(`⚠ Creating missing category '${category}' in mockDatabase`);
      mockDatabase[category] = {};
    }

    // ✅ Save to mockDatabase and localStorage
    mockDatabase[category][studyInstanceUid] = data;
    localStorage.setItem('mockDatabase', JSON.stringify(mockDatabase));

    return { success: true, message: 'Ground truth saved successfully.' };
  },

  getGroundTruth: async (studyInstanceUid, category) => {
    console.log(`📤 Mock API: Fetching Ground Truth for ${category} - ${studyInstanceUid}`);

    const storedDatabase = JSON.parse(localStorage.getItem('mockDatabase')) || mockDatabase;

    if (!storedDatabase[category]) {
      console.warn(`⚠ Category '${category}' does not exist in mockDatabase`);
      return null;
    }

    return storedDatabase[category]?.[studyInstanceUid] || null;
  },
};

export default mockApi;
