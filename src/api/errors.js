/** Eroare unificată pentru accesul la date. */
export class ApiError extends Error {
  constructor(status, code = 'ERROR') {
    super(code);
    this.name = 'ApiError';
    this.status = status; 
    this.code = code;
  }
}


export function userMessage(error) {
  let status = error?.status;
  if (status === undefined) {
    if (error?.code === 'permission-denied') status = 403;
    else if (error?.code === 'unavailable') status = 0;
  }

  switch (status) {
    case 0:
      return 'Nu s-a putut contacta serverul. Verifică conexiunea.';
    case 401:
      return 'Sesiunea a expirat. Autentifică-te din nou.';
    case 403:
      return 'Nu ai permisiunea să faci această acțiune.';
    case 404:
      return 'Elementul nu mai există.';
    case 409:
      return 'Intervalul a fost rezervat între timp. Alege altul.';
    case 400:
    case 422:
      return 'Datele trimise nu sunt valide.';
    case 429:
      return 'Prea multe cereri. Încearcă din nou peste puțin timp.';
    default:
      return 'A apărut o eroare. Încearcă din nou.';
  }
}
