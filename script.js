document.addEventListener('DOMContentLoaded', () => {
  const spoonacularApiKey = '4c1bade8a0bb49d2b21c745c646d732e'; // Replace with your new Spoonacular API key
  const youtubeApiKey = 'AIzaSyD7gQKJHACnaui8lZDHAy7RKU1VcLVmlWk'; // Replace with your YouTube API key
  const nonHalalIngredients = ['pork', 'bacon', 'ham', 'sausage', 'lard', 'wine', 'beer', 'alcohol', 'gelatin', 'rum', 'whiskey', 'vodka', 'brandy'];
  const maxApiCalls = 150; // Spoonacular free plan limit
  const callsPerRecipe = 2; // ~2 calls per recipe
  const recipesPerRequest = 15; // Fetch 15 recipes

  // Generate or retrieve user UUID
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem('userId', userId);
  }

  // Initialize API quota tracking and cache
  const today = new Date().toISOString().split('T')[0];
  let apiCallsUsed = parseInt(localStorage.getItem(`apiCallsUsed_${today}_${userId}`)) || 0;
  const recipeCache = JSON.parse(localStorage.getItem(`recipeCache_${today}_${userId}`)) || {};
  const updateQuotaDisplay = () => {
    const remainingCalls = Math.max(0, maxApiCalls - apiCallsUsed);
    const remainingTries = Math.floor(remainingCalls / (callsPerRecipe * recipesPerRequest));
    document.getElementById('api-quota').textContent = `${remainingTries} search${remainingTries !== 1 ? 'es' : ''} left today`;
    if (remainingTries === 0) {
      document.getElementById('find-recipes').disabled = true;
      document.getElementById('find-recipes').textContent = 'Daily Limit Reached';
    } else {
      document.getElementById('find-recipes').disabled = false;
      document.getElementById('find-recipes').textContent = 'Find Recipes';
    }
  };
  updateQuotaDisplay();

  document.getElementById('find-recipes').addEventListener('click', async () => {
    console.log('Button clicked');
    const ingredients = document.getElementById('ingredients').value;
    console.log('Ingredients entered:', ingredients);
    const ingredientsList = ingredients.split(/[\n,]+/).map(item => item.trim()).filter(item => item !== '');
    console.log('Processed ingredients:', ingredientsList);

    if (ingredientsList.length === 0) {
      document.getElementById('results').innerHTML = '<p>Please enter some ingredients.</p>';
      console.log('No ingredients provided');
      return;
    }

    // Check cache
    const cacheKey = ingredientsList.sort().join(',');
    if (recipeCache[cacheKey]) {
      console.log('Serving from cache:', cacheKey);
      displayRecipes(recipeCache[cacheKey]);
      return;
    }

    const recipeUrl = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${ingredientsList.join(',')}&number=${recipesPerRequest}&ranking=1&apiKey=${spoonacularApiKey}`;
    console.log('Recipe API URL:', recipeUrl);

    document.getElementById('results').innerHTML = '<p>Loading...</p>';

    try {
      const recipeResponse = await fetch(recipeUrl, { mode: 'cors' });
      console.log('Recipe API response status:', recipeResponse.status);
      if (!recipeResponse.ok) {
        if (recipeResponse.status === 402) {
          throw new Error('Spoonacular API daily limit exceeded. Try again tomorrow or get a new key at https://spoonacular.com/food-api/console.');
        }
        throw new Error(`Failed to fetch recipes: ${recipeResponse.status} ${recipeResponse.statusText}`);
      }
      const recipes = await recipeResponse.json();
      console.log('Recipe API data:', recipes);

      // Update API calls used
      apiCallsUsed += callsPerRecipe * recipes.length;
      localStorage.setItem(`apiCallsUsed_${today}_${userId}`, apiCallsUsed);
      updateQuotaDisplay();

      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = '';

      if (recipes.length === 0) {
        resultsDiv.innerHTML = '<p>No recipes found.</p>';
        console.log('No recipes returned');
        return;
      }

      // Filter out non-halal recipes
      const halalRecipes = recipes.filter(recipe => {
        const allIngredients = [
          ...recipe.usedIngredients.map(ing => ing.name.toLowerCase()),
          ...recipe.missedIngredients.map(ing => ing.name.toLowerCase())
        ];
        return !nonHalalIngredients.some(nonHalal => allIngredients.some(ing => ing.includes(nonHalal)));
      });

      if (halalRecipes.length === 0) {
        resultsDiv.innerHTML = '<p>No halal recipes found for these ingredients.</p>';
        console.log('No halal recipes after filtering');
        return;
      }

      const enrichedRecipes = [];
      for (const recipe of halalRecipes) {
        console.log('Processing recipe:', recipe.title);

        // Fetch detailed recipe information
        const infoUrl = `https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${spoonacularApiKey}`;
        const infoResponse = await fetch(infoUrl, { mode: 'cors' });
        console.log('Info API response status:', infoResponse.status);
        if (!infoResponse.ok) {
          if (infoResponse.status === 402) {
            throw new Error('Spoonacular API daily limit exceeded. Try again tomorrow or get a new key at https://spoonacular.com/food-api/console.');
          }
          throw new Error(`Failed to fetch info for ${recipe.title}: ${infoResponse.status} ${infoResponse.statusText}`);
        }
        const info = await infoResponse.json();
        let instructions = info.instructions ? info.instructions.replace(/<\/?[^>]+(>|$)/g, '') : 'No instructions available.';

        // Check instructions for non-halal terms
        const instructionsLower = instructions.toLowerCase();
        if (nonHalalIngredients.some(nonHalal => instructionsLower.includes(nonHalal))) {
          console.log(`Skipping ${recipe.title} due to non-halal instructions`);
          continue;
        }

        // Fetch YouTube video
        let videoId = '';
        try {
          const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(recipe.title + ' halal recipe')}&type=video&maxResults=1&key=${youtubeApiKey}`;
          const youtubeResponse = await fetch(youtubeUrl, { mode: 'cors' });
          console.log('YouTube API response status:', youtubeResponse.status);
          if (!youtubeResponse.ok) throw new Error(`Failed to fetch YouTube video for ${recipe.title}: ${youtubeResponse.status} ${youtubeResponse.statusText}`);
          const youtubeData = await youtubeResponse.json();
          if (youtubeData.items && youtubeData.items.length > 0) {
            videoId = youtubeData.items[0].id.videoId;
          }
        } catch (error) {
          console.error('YouTube Error:', error.message);
        }

        enrichedRecipes.push({ ...recipe, instructions, videoId });
      }

      // Cache recipes
      recipeCache[cacheKey] = enrichedRecipes;
      localStorage.setItem(`recipeCache_${today}_${userId}`, JSON.stringify(recipeCache));

      displayRecipes(enrichedRecipes);
    } catch (error) {
      console.error('Detailed Error:', error.message);
      document.getElementById('results').innerHTML = `<p>An error occurred while fetching recipes: ${error.message}</p>`;
      if (error.message.includes('402')) {
        apiCallsUsed = maxApiCalls;
        updateQuotaDisplay();
      }
    }
  });

  function displayRecipes(recipes) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    for (const recipe of recipes) {
      const recipeDiv = document.createElement('div');
      recipeDiv.className = 'recipe-card';
      recipeDiv.innerHTML = `
        <img src="${recipe.image || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${recipe.title}">
        <div class="recipe-card-content">
          <h2>${recipe.title}</h2>
          <p>Used ingredients: ${recipe.usedIngredients.map(ing => ing.name).join(', ')}</p>
          <p>Missed ingredients: ${recipe.missedIngredients.map(ing => ing.name).join(', ')}</p>
          <p class="instructions">Instructions: ${recipe.instructions.substring(0, 200)}${recipe.instructions.length > 200 ? '...' : ''}</p>
          ${recipe.videoId ? `<div class="video-container"><iframe src="https://www.youtube.com/embed/${recipe.videoId}" frameborder="0" allowfullscreen></iframe></div>` : '<p>No video available.</p>'}
          <a href="https://spoonacular.com/recipes/${recipe.title}-${recipe.id}" target="_blank">View Full Recipe</a>
          <p class="halal-note">Note: Verify halal status of ingredients (e.g., meat source) before cooking.</p>
        </div>
      `;
      resultsDiv.appendChild(recipeDiv);
    }

    // Set up Intersection Observer for fade-in
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.recipe-card').forEach(card => {
      observer.observe(card);
    });
  }
});
