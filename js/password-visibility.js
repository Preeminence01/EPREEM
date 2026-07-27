(function(){
  function addPasswordToggle(input){
    if(input.closest('.password-control')) return;

    const control = document.createElement('div');
    control.className = 'password-control';
    input.parentNode.insertBefore(control, input);
    control.appendChild(input);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.textContent = 'Show';
    toggle.addEventListener('click', () => {
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      toggle.textContent = showPassword ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
      toggle.setAttribute('aria-pressed', String(showPassword));
    });
    control.appendChild(toggle);
  }

  function initPasswordVisibility(){
    document.querySelectorAll('input[type="password"]').forEach(addPasswordToggle);
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordVisibility);
  } else {
    initPasswordVisibility();
  }
})();
