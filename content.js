// content.js

// Function to update tab title with todo count
function updateTabTitle(todos) {
  const incompleteTodos = todos.filter(todo => !todo.completed);
  if (incompleteTodos.length > 0) {
    document.title = `(${incompleteTodos.length}) ${document.title}`;
  } else {
    // Reset title if no incomplete todos
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      document.title = currentTab.title;
    });
  }
}

// Function to load todos and update tab title
function loadTodosAndUpdateTitle() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url;

    chrome.storage.sync.get(['todos'], (result) => {
      const todos = result.todos || {};
      const domainTodos = todos[url] || [];
      updateTabTitle(domainTodos);
    });
  });
}

// Mutation observer to detect title changes
const titleObserver = new MutationObserver(function(mutations) {
  loadTodosAndUpdateTitle();
});

titleObserver.observe(document.querySelector('head > title'), {
  subtree: false,
  characterData: true,
  childList: true
});

// Load todos on initial page load
loadTodosAndUpdateTitle();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'updateTodos') {
    loadTodosAndUpdateTitle();
  } else if (request.message === 'goToAnnotation') {
    scrollToAnnotation(request.annotationId);
  }
});

// Function to scroll to annotation by ID
function scrollToAnnotation(annotationId) {
  const element = document.querySelector(`[data-annotation-id="${annotationId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.style.outline = '2px solid red'; // Temporary highlight to show user
    setTimeout(() => element.style.outline = '', 2000);
  } else {
    console.error('Annotation not found:', annotationId);
  }
}

// Add click event to show comment
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('comment-text')) {
    const comment = e.target.getAttribute('title');
    showCommentPopup(e.pageX, e.pageY, comment);
  }
});

// Function to show comment popup
function showCommentPopup(x, y, comment) {
  let popup = document.getElementById('comment-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'comment-popup';
    popup.style.position = 'absolute';
    popup.style.backgroundColor = '#fff';
    popup.style.border = '1px solid #ccc';
    popup.style.padding = '5px';
    popup.style.zIndex = '1000';
    popup.style.maxWidth = '200px';
    popup.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    document.body.appendChild(popup);
  }

  popup.textContent = comment;
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.style.display = 'block';

  setTimeout(() => {
    popup.style.display = 'none';
  }, 3000);
}

// Annotation Feature
let annotationToolbar = null;
let commentInput = null;
let currentAnnotationId = null;

// Function to show annotation toolbar
function showAnnotationToolbar(x, y) {
    if (!annotationToolbar) {
        annotationToolbar = document.createElement('div');
        annotationToolbar.id = 'annotation-toolbar';
        document.body.appendChild(annotationToolbar);

        // Load the content of annotationToolbar.html into the toolbar
        fetch(chrome.runtime.getURL('annotationToolbar.html'))
            .then(response => response.text())
            .then(html => {
                annotationToolbar.innerHTML = html;

                // Add event listeners to the buttons in the toolbar
                const highlightButton = annotationToolbar.querySelector('#highlight-button');
                const commentButton = annotationToolbar.querySelector('#comment-button');
                const deleteButton = annotationToolbar.querySelector('#delete-button');

                highlightButton.addEventListener('click', highlightSelectedText);
                commentButton.addEventListener('click', () => showCommentInput(x, y));
                deleteButton.addEventListener('click', deleteAnnotation);
            })
            .catch(error => console.error('Error loading annotationToolbar.html:', error));
    }

    annotationToolbar.style.left = x + 'px';
    annotationToolbar.style.top = y + 'px';
    annotationToolbar.style.display = 'block';
}

// Function to hide annotation toolbar
function hideAnnotationToolbar() {
    if (annotationToolbar) {
        annotationToolbar.style.display = 'none';
    }
}

// Function to show comment input
function showCommentInput(x, y) {
    if (!commentInput) {
        commentInput = document.createElement('div');
        commentInput.id = 'comment-input';
        document.body.appendChild(commentInput);

        // Load the content of commentInput.html into the comment input
        fetch(chrome.runtime.getURL('commentInput.html'))
            .then(response => response.text())
            .then(html => {
                commentInput.innerHTML = html;

                const commentTextArea = commentInput.querySelector('#comment-text');
                const saveCommentButton = commentInput.querySelector('#save-comment-button');
                const cancelCommentButton = commentInput.querySelector('#cancel-comment-button');

                saveCommentButton.addEventListener('click', () => {
                    saveComment(commentTextArea.value);
                    hideCommentInput();
                });

                cancelCommentButton.addEventListener('click', () => {
                    hideCommentInput();
                });
            })
            .catch(error => console.error('Error loading commentInput.html:', error));
    }

    commentInput.style.left = x + 'px';
    commentInput.style.top = y + 'px';
    commentInput.style.display = 'block';
}

// Function to hide comment input
function hideCommentInput() {
    if (commentInput) {
        commentInput.style.display = 'none';
    }
}

// Event listener to handle mouseup events and show the annotation toolbar
document.addEventListener('mouseup', function(e) {
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
        showAnnotationToolbar(e.pageX, e.pageY);
    } else {
        hideAnnotationToolbar();
    }
});

// Event listener to handle clicks outside the annotation toolbar
document.addEventListener('mousedown', function(e) {
    if ((annotationToolbar && !annotationToolbar.contains(e.target)) && (commentInput && !commentInput.contains(e.target))) {
        hideAnnotationToolbar();
        hideCommentInput();
    }
});

// Function to highlight selected text
function highlightSelectedText() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString();

        if (selectedText.length > 0) {
            const annotationId = Date.now().toString();
            currentAnnotationId = annotationId;
            const highlightColor = '#ffeb3b'; // Default highlight color

            applyHighlight(range, annotationId, highlightColor);
            saveAnnotation(annotationId, window.location.href, selectedText, highlightColor, range, '');

            hideAnnotationToolbar();
        }
    }
}

// Function to apply highlight to the selected text
function applyHighlight(range, annotationId, color) {
    const span = document.createElement('span');
    span.className = 'web-annotator-highlight';
    span.dataset.annotationId = annotationId;
    span.style.backgroundColor = color;
    range.surroundContents(span);
}

// Function to save annotation
function saveAnnotation(annotationId, url, text, highlightColor, range, comment) {
    chrome.storage.sync.get(['annotations'], (result) => {
        const annotations = result.annotations || {};
        const domainAnnotations = annotations[url] || [];

        // Get XPath and offsets
        const xpath = getXPathForRange(range);
        const startOffset = range.startOffset;
        const endOffset = range.endOffset;

        const newAnnotation = {
            id: annotationId,
            url: url,
            text: text,
            highlightColor: highlightColor,
            position: {
                startOffset: startOffset,
                endOffset: endOffset,
                xpath: xpath
            },
            comment: comment,
            createdAt: new Date().toISOString()
        };

        domainAnnotations.push(newAnnotation);
        annotations[url] = domainAnnotations;

        chrome.storage.sync.set({ annotations: annotations }, () => {
            console.log('Annotation saved:', newAnnotation);
        });
    });
}

// Function to save comment
function saveComment(comment) {
    if (currentAnnotationId) {
        chrome.storage.sync.get(['annotations'], (result) => {
            const annotations = result.annotations || {};
            const url = window.location.href;
            const domainAnnotations = annotations[url] || [];

            const annotationIndex = domainAnnotations.findIndex(annotation => annotation.id === currentAnnotationId);

            if (annotationIndex !== -1) {
                domainAnnotations[annotationIndex].comment = comment;
                annotations[url] = domainAnnotations;

                chrome.storage.sync.set({ annotations: annotations }, () => {
                    console.log('Comment saved for annotation:', currentAnnotationId);
                });
            }
        });
    }
}

// Function to delete annotation
function deleteAnnotation() {
    // Implement delete functionality here
    hideAnnotationToolbar();
}

// Function to get XPath for a range
function getXPathForRange(range) {
    let xpathStart = getXPathForElement(range.startContainer);
    if (range.startOffset > 0) {
        xpathStart += '/text()[' + (range.startOffset + 1) + ']';
    }
    return xpathStart;
}

// Function to get XPath for an element
function getXPathForElement(element) {
    if (element && element.id)
        return '//*[@id="' + element.id + '"]';
    if (element && element.tagName === 'HTML')
        return '/html[1]';
    if (element && element.tagName === 'BODY')
        return '/html[1]/body[1]';

    let ix = 0;
    let siblings = element.parentNode.childNodes;
    for (let i = 0; i < siblings.length; i++) {
        let sibling = siblings[i];
        if (sibling === element)
            return getXPathForElement(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
            ix++;
    }
}
