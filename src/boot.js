// Paint the lightweight loading shell before evaluating the world module.
requestAnimationFrame(() => requestAnimationFrame(() => {
  import('./main.js').catch(error => {
    console.error('Unable to start world:', error);
    const loading = document.getElementById('loading-screen');
    if (!loading) return;
    loading.innerHTML = '<h1>Unable to open the island</h1><p>Please reload to try again.</p><button type="button">Try again</button>';
    loading.querySelector('button').addEventListener('click', () => location.reload());
  });
}));
