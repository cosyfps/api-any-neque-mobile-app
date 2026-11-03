/**
 * Mocks de Jest tipados con la firma de lo que reemplazan.
 *
 * `jest.fn()` sin argumentos devuelve `jest.Mock<any, any>`. Con `fn<F>()`
 * el mock acepta los mismos argumentos y debe devolver lo mismo que `F`, asi
 * que un `mockReturnValue` con la forma equivocada no compila.
 */
// `any` aqui es solo la cota del generico: el tipo que llega al test es F.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

export function fn<F extends AnyFunction>(
  implementation?: (...args: Parameters<F>) => ReturnType<F>,
): jest.Mock<ReturnType<F>, Parameters<F>> {
  return implementation === undefined
    ? jest.fn<ReturnType<F>, Parameters<F>>()
    : jest.fn<ReturnType<F>, Parameters<F>>(implementation);
}

/** Tipo del mock de `F`, para declarar variables que se asignan en `beforeEach`. */
export type MockOf<F extends AnyFunction> = jest.Mock<ReturnType<F>, Parameters<F>>;
