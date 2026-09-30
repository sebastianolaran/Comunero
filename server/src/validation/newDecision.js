const MAX_TITLE_LENGTH = 150;
const MAX_ID_LENGTH = 64;
// Decision.estimatedAmount es Int: int4 en Postgres.
const MAX_AMOUNT = 2_147_483_647;

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isId(value) {
  return isFilled(value) && value.length <= MAX_ID_LENGTH;
}

function fail(field, error) {
  return { field, error };
}

function parseTitle(value) {
  if (!isFilled(value)) return fail('title', 'El título es obligatorio');
  const trimmed = value.trim();
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return fail('title', `El título no puede superar los ${MAX_TITLE_LENGTH} caracteres`);
  }
  return { value: trimmed };
}

function parseEstimatedAmount(value) {
  if (value === undefined || value === null || value === '') return { value: null };
  if (!Number.isSafeInteger(value)) {
    return fail('estimatedAmount', 'El monto estimado tiene que ser un número entero');
  }
  if (value <= 0) return fail('estimatedAmount', 'El monto estimado tiene que ser mayor a cero');
  if (value > MAX_AMOUNT) return fail('estimatedAmount', 'El monto estimado es demasiado grande');
  return { value };
}

// Devuelve { decision } o { error, field } con el primer campo invalido.
function parseNewDecision(body) {
  // express.json acepta `null` o un número como body: sin esto el destructuring tira.
  const { assetId, userId, title, estimatedAmount } = body !== null && typeof body === 'object' ? body : {};
  if (!isId(assetId)) return fail('assetId', 'Falta el bien');
  // TODO: el userId tiene que salir de la sesion cuando exista el login.
  if (!isId(userId)) return fail('userId', 'Falta el copropietario que propone');

  const parsedTitle = parseTitle(title);
  if (parsedTitle.error) return parsedTitle;
  const parsedAmount = parseEstimatedAmount(estimatedAmount);
  if (parsedAmount.error) return parsedAmount;

  return {
    decision: { assetId, userId, title: parsedTitle.value, estimatedAmount: parsedAmount.value },
  };
}

module.exports = { parseNewDecision };
