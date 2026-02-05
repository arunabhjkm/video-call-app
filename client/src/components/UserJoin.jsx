import React, { useState } from 'react';
import './UserJoin.css';

function UserJoin() {
    const [slotId, setSlotId] = useState('');
    const [name, setName] = useState('');

    const handleJoin = (e) => {
        e.preventDefault();
        if (slotId.trim() && name.trim()) {
            window.location.href = `/?s=${slotId.trim()}&n=${name.trim()}`;
        }
    };

    return (
        <div className="user-join-container">
            <div className="user-join-card">
                <h1 className="user-join-title">Join Meeting</h1>
                <form onSubmit={handleJoin} className="user-join-form">
                    <div className="form-group">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your Name"
                            required
                            className="join-input"
                        />
                    </div>
                    <div className="form-group">
                        <input
                            type="text"
                            value={slotId}
                            onChange={(e) => setSlotId(e.target.value)}
                            placeholder="Slot ID"
                            required
                            className="join-input"
                        />
                    </div>
                    <button type="submit" className="join-button">
                        Join Meeting
                    </button>
                </form>
            </div>
        </div>
    );
}

export default UserJoin;
