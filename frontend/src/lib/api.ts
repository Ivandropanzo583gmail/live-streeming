import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3333",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de resposta para padronizar erros da API
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Erro de comunicação com o servidor";

    return Promise.reject(new Error(message));
  }
);

export default API;