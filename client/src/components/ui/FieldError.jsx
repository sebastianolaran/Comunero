// Error de un campo o de un formulario. Con id, el campo lo enlaza con
// aria-describedby; role="alert" lo anuncia apenas aparece.
function FieldError({ id, children }) {
  if (!children) return null
  return (
    <p id={id} className="field-err" role="alert">
      {children}
    </p>
  )
}

export default FieldError
