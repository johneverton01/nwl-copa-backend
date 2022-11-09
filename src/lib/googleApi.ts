import axios from "axios"

export const googleApi = axios.create({
  baseURL: "https://www.googleapis.com/oauth2/v2/userinfo"
});
