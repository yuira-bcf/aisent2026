declare module "ioredis" {
  interface RedisOptions {
    connectTimeout?: number;
    lazyConnect?: boolean;
  }
  class Redis {
    constructor(url: string, options?: RedisOptions);
    connect(): Promise<void>;
    ping(): Promise<string>;
    quit(): Promise<string>;
  }
  export default Redis;
}
