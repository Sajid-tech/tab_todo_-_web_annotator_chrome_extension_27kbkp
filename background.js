// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('Tab Todo & Web Annotator installed.');

  // Create context menu items
  chrome.contextMenus.create({
    id: 'saveSelection',
    title: 'Save Selection to Extension',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'addComment',
    title: 'Add Comment to Selection',
    contexts: ['selection']
  });
});

// Function to execute script in tab
function executeScriptInTab(tabId, func, args) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: func,
    args: args
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error executing script:", chrome.runtime.lastError.message);
    }
  });
}

// Context menu item click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveSelection') {
    const selectedText = info.selectionText;
    const url = tab.url;
    const id = Date.now().toString();

    // Save the selected text and URL to storage
    chrome.storage.sync.get(['savedSelections'], (result) => {
      const savedSelections = result.savedSelections || [];
      const newSelection = {
        id: id,
        text: selectedText,
        url: url
      };

      savedSelections.push(newSelection);
      chrome.storage.sync.set({ savedSelections: savedSelections }, () => {
        console.log('Selection saved:', newSelection);

        // Execute script to highlight the text
        executeScriptInTab(tab.id, highlightText, [selectedText, id, null]);
      });
    });
  } else if (info.menuItemId === 'addComment') {
    const selectedText = info.selectionText;
    const url = tab.url;
    const id = Date.now().toString();

    // Prompt for comment
    const comment = prompt("Enter your comment:");
    if (comment !== null) {
      // Save the selected text, URL, and comment to storage
      chrome.storage.sync.get(['savedSelections'], (result) => {
        const savedSelections = result.savedSelections || [];
        const newSelection = {
          id: id,
          text: selectedText,
          url: url,
          comment: comment
        };

        savedSelections.push(newSelection);
        chrome.storage.sync.set({ savedSelections: savedSelections }, () => {
          console.log('Selection saved with comment:', newSelection);

          // Execute script to highlight the text with comment
          executeScriptInTab(tab.id, highlightText, [selectedText, id, comment]);
        });
      });
    }
  }
});

// Highlight Text Function
function highlightText(text, id, comment) {
  const markId = 'selection-' + id;
  const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while ((node = treeWalker.nextNode())) {
    if (regex.test(node.nodeValue)) {
      const newNodeValue = node.nodeValue.replace(
        regex,
        (match) => {
          if (comment) {
            return `<mark id="${markId}" class="highlighted-text comment-text" title="${comment}">${match}</mark>`;
          } else {
            return `<mark id="${markId}" class="highlighted-text">${match}</mark>`;
          }
        }
      );

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newNodeValue;

      while (tempDiv.firstChild) {
        node.parentNode.insertBefore(tempDiv.firstChild, node);
      }
      node.parentNode.removeChild(node);
    }
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Send a message to the content script to update todos
    chrome.tabs.sendMessage(tabId, { message: 'updateTodos' });
  }
});
