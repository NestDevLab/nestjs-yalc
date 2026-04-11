module.exports = {
  name: 'nestjs-graphql-plugin-wrapper',
  version: 1,
  factory() {
    return () => (sf) => sf;
  },
};
