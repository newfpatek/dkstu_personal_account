// import React, { useState } from 'react';

// function LoginForm() {
//     const [email, setEmail] = useState('');
//     const [password, setPassword] = useState('');
//     const [error, setError] = useState('');

//     const handleSubmit = async (e) => {
//         e.preventDefault();
        
//         if (!email || !password) {
//         setError('Заполните все поля');
//         return;
//         }

//         try {
//         const response = await fetch('#', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ email, password }),
//         });

//         if (!response.ok) {
//             throw new Error('Неверный логин или пароль');
//         }

//         const data = await response.json();
//         // Сохраняем токен (например, в localStorage)
//         localStorage.setItem('token', data.token);
//         setError('');
//         alert('Вход успешен!');
        
//         } catch (err) {
//         setError(err.message);
//         }
//     };

//     return (
//         <div style={{ maxWidth: 400, margin: '50px auto', padding: '20px', border: '1px solid #ccc' }}>
//         <h2>Вход в систему</h2>
//         {error && <p style={{ color: 'red' }}>{error}</p>}
//         <form onSubmit={handleSubmit}>
//             <div style={{ marginBottom: '15px' }}>
//             <label>Email:</label>
//             <input 
//                 type="email" 
//                 value={email} 
//                 onChange={(e) => setEmail(e.target.value)} 
//                 style={{ width: '100%', padding: '8px' }}
//             />
//             </div>
//             <div style={{ marginBottom: '15px' }}>
//             <label>Пароль:</label>
//             <input 
//                 type="password" 
//                 value={password} 
//                 onChange={(e) => setPassword(e.target.value)} 
//                 style={{ width: '100%', padding: '8px' }}
//             />
//             </div>
//             <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer' }}>
//             Войти
//             </button>
//         </form>
//         </div>
//     );
// }

// export default LoginForm;