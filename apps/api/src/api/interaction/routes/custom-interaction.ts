export default {
  routes: [
    {
      method: 'POST',
      path: '/interactions/toggle',
      handler: 'api::interaction.interaction.toggle',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/interactions/mine',
      handler: 'api::interaction.interaction.mine',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
