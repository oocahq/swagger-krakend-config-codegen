import yaml from 'js-yaml';
import fps from 'fs/promises';
import {URL, URLSearchParams} from 'url';
const defaultEndpointConfig = {
  rateLimit: {
    maxRate: 5,
    clientMaxRate: 0,
    strategy: 'ip',
  },
  proxy: {
    sequential: false,
  },
};
async function main(...args: any[]) {
  const fileContents = Buffer.from(
    await fps.readFile(args[args.length - 1])
  ).toString();
  const yamlContents: any = yaml.load(fileContents);
  console.log(yamlContents);
  const defaultGBackend = yamlContents['x-google-backend'];
  const krakenDConfig: any = {};
  krakenDConfig.version = 2;
  krakenDConfig.extra_config = {} as any;
  krakenDConfig.extra_config['github_com/devopsfaith/krakend-cors'] = {
    allow_origins: ['*'],
    expose_headers: ['Content-Length'],
    max_age: '12h',
    allow_methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allow_credentials: true,
  };
  krakenDConfig.extra_config['github_com/devopsfaith/krakend-gologging'] = {
    level: 'DEBUG',
    prefix: '[KRAKEND]',
    syslog: false,
    stdout: true,
    format: 'default',
  };
  krakenDConfig.extra_config['github_com/devopsfaith/krakend-logstash'] = {
    enable: false,
  };
  krakenDConfig.timeout = '3000ms';
  krakenDConfig.cache_ttl = '300s';
  krakenDConfig.output_encoding = 'json';
  krakenDConfig.name = yamlContents.info.title;
  krakenDConfig.port = 80;
  krakenDConfig.tls = {
    public_key: '/path/to/cert.pem',
    private_key: '/path/to/key.pem',
  };
  krakenDConfig.endpoints = [] as any[];

  for (const path in yamlContents.paths) {
    for (const method in yamlContents.paths[path]) {
      const endpoint = {} as any;
      endpoint.endpoint = path;
      endpoint.method = String(method).toUpperCase();
      endpoint.output_encoding = 'json';
      endpoint.extra_config = {
        'github.com/devopsfaith/krakend-ratelimit/juju/router':
          defaultEndpointConfig.rateLimit,
        'github.com/devopsfaith/krakend/proxy':
          defaultEndpointConfig.proxy.sequential,
      };
      endpoint.querystring_params = Array.from(
        yamlContents.paths[path][method].parameters ?? []
      )
        .filter((param: any) => param.in === 'query')
        .map((param: any) => param.name);
      endpoint.backend = [] as any[];
      const gBackend =
        yamlContents.paths[path][method]['x-google-backend'] ?? defaultGBackend;
      const gBackendUrl = new URL(gBackend.address);
      const host = gBackendUrl.hostname;
      let url_pattern = path;
      if (gBackend.path_translation === 'CONSTANT_ADDRESS') {
        url_pattern = gBackendUrl.pathname;
      }
      endpoint.backend.push({
        url_pattern,
        host: [host],
        encoding: 'json',
        sd: 'dns',
        method,
        disable_host_sanitize: false,
      });

      krakenDConfig.endpoints.push(endpoint);
    }
  }

  console.log(JSON.stringify(krakenDConfig));
}

main(...process.argv);
