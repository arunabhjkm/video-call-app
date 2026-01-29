import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ThankYou.css';

function ThankYou() {
  const navigate = useNavigate();

  return (
    <div className="thankyou-container">
      <div className="thankyou-card">
        <h1 className="thankyou-title">Thank You for joining</h1>
        <p className="thankyou-subtitle">The meeting has ended.</p>
        <button className="thankyou-button" onClick={() => navigate('/')}>
          Go to Home
        </button>
      </div>
    </div>
  );
}

export default ThankYou;

