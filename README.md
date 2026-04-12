# ChatGPT-like Application with Spring Boot 3 and React 18

This application implements a ChatGPT-like interface with Spring Boot 3 as the backend and React 18 as the frontend, using Server-Sent Events (SSE) for real-time communication.

## Features
- Chat interface with conversation history
- Real-time message streaming using SSE
- Conversation management (create new, switch between conversations)
- Local storage of conversation history
- Ant Design 5 for UI components

## Technologies Used
- **Backend**: Spring Boot 3
- **Frontend**: React 18, Ant Design 5, Vite
- **Communication**: Server-Sent Events (SSE)
- **Storage**: Browser localStorage

## Getting Started

### Prerequisites
- Java 21 or higher
- Node.js 18 or higher
- Maven
- npm

### Running the Backend (Spring Boot 3)
1. Navigate to the springboot3 directory:
   ```
   cd springboot3
   ```
2. Run the Spring Boot application:
   ```
   mvn spring-boot:run
   ```
   The backend server will start on http://localhost:8080

### Running the Frontend (React 18)
1. Navigate to the vite-project-react18 directory:
   ```
   cd vite-project-react18
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```
   The frontend server will start on http://localhost:5173

### Accessing the Application
Open your browser and navigate to http://localhost:5173/chat to access the chat interface.

## How It Works
1. **Frontend**: The React application provides a chat interface with conversation history on the left and the chat area on the right.
2. **Backend**: The Spring Boot application handles SSE connections and simulates AI responses.
3. **Communication**: When a user sends a message, the frontend establishes an SSE connection with the backend. The backend sends responses chunk by chunk, simulating a real-time typing effect.
4. **Storage**: Conversation history is stored in the browser's localStorage.

## Notes
- This is a demo application with simulated AI responses.
- In a production environment, you would replace the simulated responses with actual AI model integration.
- The application uses CORS configuration to allow cross-origin requests between frontend and backend.