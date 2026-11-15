// Example model builders, also exercised by the format tests.
export function sampleArchitectureModel() {
  return {
    schemaVersion: "0.1",
    layers: [
      { id: "domain", label: "Domain", order: 0 },
      { id: "application", label: "Application", order: 1 },
      { id: "adapters", label: "Adapters", order: 2 },
    ],
    components: [
      { id: "user", label: "User", layerId: "domain", kind: "entity", groupId: "user" },
      { id: "create-user", label: "CreateUser", layerId: "application", kind: "usecase", groupId: "user" },
      {
        id: "user-repository-port",
        label: "UserRepository",
        layerId: "application",
        kind: "port",
        socket: "spi",
        groupId: "user",
      },
      {
        id: "user-api",
        label: "User API",
        layerId: "application",
        kind: "port",
        socket: "api",
        groupId: "user",
      },
      { id: "sql-user-repository", label: "SqlUserRepository", layerId: "adapters", kind: "adapter", groupId: "user" },
      { id: "rest-controller", label: "REST", layerId: "adapters", kind: "adapter", groupId: "user" },
    ],
    relations: [
      { from: "rest-controller", to: "user-api", kind: "depends-on", source: "declared" },
      { from: "user-api", to: "create-user", kind: "uses-port", source: "declared" },
      { from: "create-user", to: "user", kind: "depends-on", source: "declared" },
      { from: "create-user", to: "user-repository-port", kind: "uses-port", source: "declared" },
      { from: "sql-user-repository", to: "user-repository-port", kind: "implements-port", source: "declared" },
    ],
  };
}

export function sampleContextsModel() {
  return {
    schemaVersion: "0.2",
    contexts: [
      {
        id: "sales",
        label: "販売コンテキスト",
        layers: [
          { id: "domain", label: "ドメイン層", order: 0 },
          { id: "usecase", label: "ユースケース層", order: 1 },
          { id: "outer", label: "外側", order: 2 },
        ],
        components: [
          { id: "order", label: "Order", layerId: "domain", kind: "entity" },
          { id: "place-order", label: "PlaceOrder", layerId: "usecase", kind: "usecase" },
          { id: "sales-ui", label: "UI", layerId: "outer", kind: "presentation", sector: "presentation" },
          { id: "shipping-adapter", label: "Adapter", layerId: "outer", kind: "adapter", sector: "infrastructure" },
          { id: "event-adapter", label: "Adapter", layerId: "outer", kind: "adapter", sector: "infrastructure" },
          { id: "sales-test", label: "Test", layerId: "outer", kind: "test", sector: "test" },
        ],
        relations: [
          { from: "place-order", to: "order", kind: "depends-on" },
          { from: "sales-ui", to: "place-order", kind: "depends-on" },
          { from: "shipping-adapter", to: "place-order", kind: "depends-on" },
          { from: "event-adapter", to: "place-order", kind: "depends-on" },
          { from: "sales-test", to: "place-order", kind: "depends-on" },
        ],
      },
      {
        id: "delivery",
        label: "配送コンテキスト",
        layers: [
          { id: "domain", label: "ドメイン層", order: 0 },
          { id: "usecase", label: "ユースケース層", order: 1 },
          { id: "outer", label: "外側", order: 2 },
        ],
        components: [
          { id: "shipment", label: "Shipment", layerId: "domain", kind: "entity" },
          { id: "arrange-shipping", label: "ArrangeShipping", layerId: "usecase", kind: "usecase" },
          { id: "shipping-api", label: "API", layerId: "outer", kind: "port", socket: "api", sector: "presentation" },
          { id: "shipping-worker", label: "Worker", layerId: "outer", kind: "adapter", sector: "infrastructure" },
          { id: "delivery-test", label: "Test", layerId: "outer", kind: "test", sector: "test" },
        ],
        relations: [
          { from: "arrange-shipping", to: "shipment", kind: "depends-on" },
          { from: "shipping-api", to: "arrange-shipping", kind: "uses-port" },
          { from: "shipping-worker", to: "arrange-shipping", kind: "depends-on" },
          { from: "delivery-test", to: "arrange-shipping", kind: "depends-on" },
        ],
      },
    ],
    buses: [{ id: "order-message", label: "Message" }],
    links: [
      { from: "sales:shipping-adapter", to: "delivery:shipping-api", kind: "request", label: "Request" },
      { from: "sales:event-adapter", to: "bus:order-message", kind: "publish", label: "publish" },
      { from: "delivery:shipping-worker", to: "bus:order-message", kind: "subscribe", label: "subscribe" },
    ],
  };
}
