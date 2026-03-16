import axios from 'axios'

const baseURL = '/api/web'

const generateEndpoint = () => {
  return axios.get(baseURL)
}

const create = (endpoint, masterToken) => {
  const headers = masterToken ? { 'master-token': masterToken } : {}
  return axios.post(`${baseURL}/${endpoint}`, {}, { headers })
}

const getRequests = (endpoint) => {
  return axios.get(`${baseURL}/${endpoint}`)
}

const deleteBasket = (endpoint) => {
  return axios.delete(`${baseURL}/${endpoint}`)
}

const deleteRequest = (requestId) => {
  return axios.delete(`${baseURL}/requests/${requestId}`)
}

const basketService = {
  generateEndpoint,
  create,
  getRequests,
  deleteBasket,
  deleteRequest
}

export default basketService
