/**
 * Popup Logic for PriorityPing
 */
document.addEventListener('DOMContentLoaded', async () => {
    const storage = await chrome.storage.local.get('ppCourseImportance');
    const importance = storage.ppCourseImportance || {};

    const selects = document.querySelectorAll('select');
    
    // Set initial values
    selects.forEach(select => {
        const courseCode = select.closest('.course-row').dataset.course;
        if (importance[courseCode]) {
            select.value = importance[courseCode];
        }
        
        // Listen for changes
        select.addEventListener('change', async () => {
            const newImportance = {};
            document.querySelectorAll('.course-row').forEach(row => {
                const code = row.dataset.course;
                const val = row.querySelector('select').value;
                newImportance[code] = val;
            });
            
            await chrome.storage.local.set({ ppCourseImportance: newImportance });
            
            // Send rerender message to active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'PP_RERENDER' });
                }
            });
        });
    });
});
