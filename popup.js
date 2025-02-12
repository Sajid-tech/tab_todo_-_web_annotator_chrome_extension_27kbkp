document.addEventListener('DOMContentLoaded', () => {
  const todoList = document.getElementById('todo-list');
  const newTodoInput = document.getElementById('new-todo');
  const addTodoButton = document.getElementById('add-todo-button');
  const savedSelectionsDiv = document.getElementById('saved-selections');

  // Load todos from storage
  function loadTodos() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const url = currentTab.url;

      chrome.storage.sync.get(['todos'], (result) => {
        const todos = result.todos || {};
        const domainTodos = todos[url] || [];

        todoList.innerHTML = ''; // Clear existing list
        domainTodos.forEach(todo => {
          const listItem = document.createElement('div');
          listItem.textContent = todo.text;
          todoList.appendChild(listItem);
        });
      });
    });
  }

  // Add a new todo
  addTodoButton.addEventListener('click', () => {
    const newTodoText = newTodoInput.value.trim();
    if (newTodoText !== '') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const url = currentTab.url;

        chrome.storage.sync.get(['todos'], (result) => {
          const todos = result.todos || {};
          const domainTodos = todos[url] || [];

          const newTodo = {
            id: Date.now().toString(),
            text: newTodoText,
            completed: false,
            url: url,
            createdAt: new Date().toISOString()
          };

          domainTodos.push(newTodo);
          todos[url] = domainTodos;

          chrome.storage.sync.set({ todos: todos }, () => {
            loadTodos(); // Reload the todo list
            newTodoInput.value = ''; // Clear the input
          });
        });
      });
    }
  });

  // Load saved selections
  function loadSavedSelections() {
    chrome.storage.sync.get(['savedSelections'], (result) => {
      const savedSelections = result.savedSelections || [];
      savedSelectionsDiv.innerHTML = ''; // Clear existing list

      savedSelections.forEach(selection => {
        const selectionDiv = document.createElement('div');
        selectionDiv.classList.add('selection-item');
        selectionDiv.textContent = selection.text;

        if (selection.comment) {
          const commentSpan = document.createElement('span');
          commentSpan.classList.add('comment-indicator');
          commentSpan.title = selection.comment;
          selectionDiv.appendChild(commentSpan);
        }

        const navigateButton = document.createElement('button');
        navigateButton.textContent = 'Go to';
        navigateButton.addEventListener('click', () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                message: 'goToAnnotation',
                annotationId: selection.id
              });
            } else {
              console.error('No active tabs found.');
            }
          });
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
          deleteSelection(selection.id);
        });

        selectionDiv.appendChild(navigateButton);
        selectionDiv.appendChild(deleteButton);
        savedSelectionsDiv.appendChild(selectionDiv);
      });
    });
  }

  // Delete selection
  function deleteSelection(id) {
    chrome.storage.sync.get(['savedSelections'], (result) => {
      let savedSelections = result.savedSelections || [];
      savedSelections = savedSelections.filter(selection => selection.id !== id);
      chrome.storage.sync.set({ savedSelections: savedSelections }, () => {
        loadSavedSelections();
      });
    });
  }

  loadTodos();
  loadSavedSelections();
});
