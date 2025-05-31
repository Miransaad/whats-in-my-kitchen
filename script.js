document.getElementById('find-recipes').addEventListener('click', async function() {
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

  const spoonacularApiKey = 'fe6c4ccc4d27476ab985b0e87f16868c'; // Replace with your Spoonacular API key
  const youtubeApiKey = 'AIzaSyD7gQKJHACnaui8lZDHAy7RKU1VcLVmlWk'; // Replace with your YouTube API key
  const nonHalalIngredients = ['pork', 'bacon', 'ham', 'sausage', 'lard', 'wine', 'beer', 'alcohol', 'gelatin', 'rum', 'whiskey', 'vodka', 'brandy'];
  const recipeUrl = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${ingredientsList.join(',')}&number=20&ranking=1&apiKey=${spoonacularApiKey}`;
  console.log('Recipe API URL:', recipeUrl);

  document.getElementById('results').innerHTML = '<p>Loading...</p>';

  try {
    const recipeResponse = await fetch(recipeUrl);
    console.log('Recipe API response status:', recipeResponse.status);
    if (!recipeResponse.ok) throw new Error('Failed to fetch recipes');
    const recipes = await recipeResponse.json();
    console.log('Recipe API data:', recipes);

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

    for (const recipe of halalRecipes) {
      console.log('Processing recipe:', recipe.title);

      // Fetch detailed recipe information (instructions)
      const infoUrl = `https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${spoonacularApiKey}`;
      const infoResponse = await fetch(infoUrl);
      console.log('Info API response status:', infoResponse.status);
      if (!infoResponse.ok) throw new Error(`Failed to fetch info for ${recipe.title}`);
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
        const youtubeResponse = await fetch(youtubeUrl);
        console.log('YouTube API response status:', youtubeResponse.status);
        if (!youtubeResponse.ok) throw new Error(`Failed to fetch YouTube video for ${recipe.title}`);
        const youtubeData = await youtubeResponse.json();
        if (youtubeData.items && youtubeData.items.length > 0) {
          videoId = youtubeData.items[0].id.videoId;
        }
      } catch (error) {
        console.error('YouTube Error:', error);
      }

      const recipeDiv = document.createElement('div');
      recipeDiv.className = 'recipe-card';
      recipeDiv.innerHTML = `
        <img src="${recipe.image || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${recipe.title}">
        <div class="recipe-card-content">
          <h2>${recipe.title}</h2>
          <p>Used ingredients: ${recipe.usedIngredients.map(ing => ing.name).join(', ')}</p>
          <p>Missed ingredients: ${recipe.missedIngredients.map(ing => ing.name).join(', ')}</p>
          <p class="instructions">Instructions: ${instructions.substring(0, 200)}${instructions.length > 200 ? '...' : ''}</p>
          ${videoId ? `<div class="video-container"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>` : '<p>No video available.</p>'}
          <a href="https://spoonacular.com/recipes/${recipe.title}-${recipe.id}" target="_blank">View Full Recipe</a>
          <p class="halal-note">Note: Verify halal status of ingredients (e.g., meat source) before cooking.</p>
        </div>
      `;
      resultsDiv.appendChild(recipeDiv);
    }

    // Set up Intersection Observer for fade-in effect
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
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('results').innerHTML = '<p>An error occurred while fetching recipes.</p>';
  }
});