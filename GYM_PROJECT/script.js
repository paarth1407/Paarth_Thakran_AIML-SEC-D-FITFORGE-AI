document.addEventListener('DOMContentLoaded', () => {
    const fatigue = document.querySelector('#scanner-left .badge.fatigue');
    const wrong = document.querySelector('#scanner-left .badge.wrong');
    const correct = document.querySelector('#scanner-right .badge.correct');
  
    setInterval(() => {
      fatigue.classList.toggle('fade');
      wrong.classList.toggle('fade');
      correct.classList.toggle('fade');
    }, 3000);
  });