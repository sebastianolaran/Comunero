// URL base del backend. En build, Vite reemplaza import.meta.env.VITE_API_URL
// por el valor del entorno; si no esta seteada, cae al server local.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
