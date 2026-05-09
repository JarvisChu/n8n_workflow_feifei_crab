const fs = require('fs');
const path = require('path');

// 输入文件：支持命令行指定，默认为 request.json
const inputFile = process.argv[2] || 'request.json';
// 输出文件：检查结果
const outputFile = process.argv[3] || 'request_check_result.json';

// 读取请求数据（n8n webhook 收到的请求 dump）
const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// 仅保留与 workflow 相关的字段，去除其它无关字段（如 query、token 等顶层冗余）
const ALLOWED_FIELDS = ['headers', 'params', 'body', 'webhookUrl', 'executionMode'];
const cleanedData = rawData.map((item) => {
  const cleaned = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in item) cleaned[key] = item[key];
  }
  return cleaned;
});

// 封装 n8n 的 $input，模拟 Code 节点运行环境
function makeInput(data) {
  return {
    all: () => data.map((d) => ({ json: d })),
    first: () => ({ json: data[0] })
  };
}

// 执行 n8n Code 节点代码：源码必须以 `return $input.all()` 之类返回值结尾
function runNode(filename, data) {
  const code = fs.readFileSync(filename, 'utf8');
  // 用 Function 构造器把节点源码包成函数，注入 $input
  const fn = new Function('$input', code);
  const result = fn(makeInput(data));
  // 将返回的 [{json:...}] 写回 data 数组
  for (let i = 0; i < result.length; i++) {
    data[i] = result[i].json;
  }
}

// 执行 parse_request 节点
runNode(path.join(__dirname, 'n8n_node_parse_request.js'), cleanedData);

// 写出检查结果
fs.writeFileSync(outputFile, JSON.stringify(cleanedData, null, 2), 'utf8');

// 打印摘要
console.log('输入文件:', inputFile);
console.log('输出文件:', outputFile);
for (let i = 0; i < cleanedData.length; i++) {
  const r = cleanedData[i];
  console.log(`\n--- item[${i}] ---`);
  console.log('  request_error_message:', r.request_error_message || '(空)');
  if (!r.request_error_message) {
    console.log('  request_user_id:', r.request_user_id);
    console.log('  request_organization_id:', r.request_organization_id);
    console.log('  request_file_list 数量:', r.request_file_list?.length ?? 0);
    for (const f of r.request_file_list || []) {
      console.log(`    - [${f.id}] ${f.name}`);
    }
  }
}
