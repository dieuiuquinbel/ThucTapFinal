import axios from 'axios';

export const API_BASE = '/api';

export const setAuthTokenHeader = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

export default axios;
