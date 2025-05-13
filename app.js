// DOM elements
const questionInput = document.getElementById('question-input');
const searchButton = document.getElementById('search-button');
const contextResults = document.getElementById('context-results');
const answerResults = document.getElementById('answer-results');
const loadingIndicator = document.getElementById('loading-indicator');

// Store retrieved contexts for use in answer generation
let retrievedContexts = [];

// Add event listener for search button
searchButton.addEventListener('click', handleSearch);

// Also trigger search on Enter key in textarea
questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSearch();
  }
});

// Main search handler function
async function handleSearch() {
  const query = questionInput.value.trim();
  
  // Validate input
  if (!query) {
    alert('Please enter a question');
    return;
  }
  
  // Clear previous results
  contextResults.innerHTML = '';
  answerResults.innerHTML = '';
  retrievedContexts = [];
  
  try {
    // Step 1: Search for context
    await searchForContext(query);
    
    // Step 2: Generate answer with Claude
    await generateAnswer(query);
    
  } catch (error) {
    console.error('Error during search process:', error);
    answerResults.innerHTML = `<div class="error">An error occurred: ${error.message}</div>`;
  }
}

// Function to search for context
async function searchForContext(query) {
  try {
    // Show loading state
    contextResults.innerHTML = '<div>Searching for relevant information...</div>';
    
    // Call the backend API to search
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to retrieve context');
    }
    
    const data = await response.json();
    retrievedContexts = data.contexts || [];
    
    // Display the contexts
    if (retrievedContexts.length === 0) {
      contextResults.innerHTML = '<div>No relevant contexts found.</div>';
    } else {
      contextResults.innerHTML = retrievedContexts
        .map(context => `<div class="context-item">${context.id}. ${context.text}</div>`)
        .join('');
    }
    
  } catch (error) {
    console.error('Error fetching context:', error);
    contextResults.innerHTML = `<div class="error">Error fetching context: ${error.message}</div>`;
    throw error;
  }
}

// Function to generate an answer using Claude
async function generateAnswer(query) {
  try {
    // Show loading state
    loadingIndicator.classList.remove('hidden');
    
    // Call the backend API to generate an answer
    const response = await fetch('/api/generate-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        contexts: retrievedContexts,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate answer');
    }
    
    const data = await response.json();
    
    // Hide loading indicator
    loadingIndicator.classList.add('hidden');
    
    // Display the answer
    answerResults.innerHTML = data.answer || 'No answer generated.';
    
  } catch (error) {
    console.error('Error generating answer:', error);
    loadingIndicator.classList.add('hidden');
    answerResults.innerHTML = `<div class="error">Error generating answer: ${error.message}</div>`;
    throw error;
  }
}