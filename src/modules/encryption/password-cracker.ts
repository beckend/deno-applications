export class PasswordCracker {
  static crack<
    T1 extends {
      readonly crack: <
        TFn1 extends {
          readonly password: string
        }
      >(
        x: TFn1
      ) => boolean
    }
  >(x: T1) {
    Boolean(x)
  }
}
