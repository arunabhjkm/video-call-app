import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ThankYou.css';

function ThankYou() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomID, name } = location.state || {};

  const handleRejoin = () => {
    if (roomID) {
      // Rejoin with same params
      let url = `/?slot=${roomID}`;
      if (name && name !== 'Guest') {
        url += `&n=${name}`;
      }
      navigate(url);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="thankyou-container">
      <div className="thankyou-card">
        <h1 className="thankyou-title">Thank You for joining</h1>
        <p className="thankyou-subtitle">The meeting has ended.</p>
        <button className="thankyou-button" onClick={handleRejoin}>
          {roomID ? 'Rejoin' : 'Back to Home'}
        </button>
      </div>
    </div>
  );
}

export default ThankYou;

