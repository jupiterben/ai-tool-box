export const name = "hello"
export const inject = ["tools"]

export function apply(ctx) {
  ctx.tools.register({
    name: "hello",
    description: "Return a hello payload so you can verify local plugins load.",
    parameters: { type: "object", properties: {} },
    async execute() {
      return { message: "hello from .xms plugin" };
    },
  })
}
