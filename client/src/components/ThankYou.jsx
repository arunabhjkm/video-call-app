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
        <div className="checkmark-wrapper">
          <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
            <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
        </div>
        <h1 className="thankyou-title">Meeting has successfully ended</h1>
        <p className="thankyou-subtitle">Thank you for joining.</p>
        <button className="thankyou-button" onClick={handleRejoin}>
          {roomID ? 'Rejoin' : 'Back to Home'}
        </button>
      </div>
    </div>
  );
}

export default ThankYou;

