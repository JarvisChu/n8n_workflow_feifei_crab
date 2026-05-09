function isNullOrUndefined(value) {
  return value === null || value === undefined;
}

function isValidString(value) {
  if (isNullOrUndefined(value)) return false;
  return typeof value === 'string';
}

function isValidNotEmptyString(value) {
  if (!isValidString(value)) return false;
  if (value.trim() === '') return false;
  return true;
}

// 解析 input.fields 中某个 id 的文件列表字段，统一返回 { error_message, file_list }
function parseFieldFiles(fields, id) {
  const value_file_list = fields.find((f) => f?.id === id)?.value;
  if (!Array.isArray(value_file_list)) {
    return {
      error_message: 'invalid input.fields.' + id,
      file_list: []
    };
  }

  const file_list = [];
  for (const file of value_file_list) {
    const file_name = file?.fileName;
    const source = file?.source;
    // 文件名和 source 都必须是非空字符串
    if (!isValidNotEmptyString(file_name) || !isValidNotEmptyString(source)) {
      return {
        error_message: 'invalid input.fields.' + id + '.value, file name or source empty',
        file_list: []
      };
    }
    file_list.push({
      id: id,
      name: file_name,
      source: source
    });
  }
  return {
    error_message: '',
    file_list: file_list
  };
}

// 检查请求参数是否合法，同时将请求参数解析并保存到 json.request_xxx 中
for (const item of $input.all()) {
  const body = item.json.body;
  if (isNullOrUndefined(body)) {
    item.json.request_valid = false;
    item.json.request_error_message = 'body required';
    continue;
  }

  // 必须包含 user_id 字段
  const user_id = body.user_id;
  if (!isValidNotEmptyString(user_id)) {
    item.json.request_valid = false;
    item.json.request_error_message = 'user_id required';
    continue;
  }
  item.json.request_user_id = user_id.trim();

  // 必须包含 organization_id 字段
  const organization_id = body.organization_id;
  if (!isValidNotEmptyString(organization_id)) {
    item.json.request_valid = false;
    item.json.request_error_message = 'organization_id required';
    continue;
  }
  item.json.request_organization_id = organization_id.trim();

  // 其它和该 workflow 相关的参数
  const fields = body.input?.fields;
  if (!Array.isArray(fields)) {
    item.json.request_valid = false;
    item.json.request_error_message = 'invalid input.fields';
    continue;
  }

  // 依次解析每个文件字段，任一失败则整体失败
  let error_message = '';
  const all_files = [];
  const file_field_ids = [
    'feedme_excels', // FEEDME 收款汇总表（每张对应一个门店）
    'tng_merchant_report_excel', // TNG Merchant Report excel 文件
    'product_sales_report_excels' // Product Sales Report excel 文件（与 FEEDME 收款汇总表一一对应）
  ];
  for (const field_id of file_field_ids) {
    const res = parseFieldFiles(fields, field_id);
    if (isValidNotEmptyString(res.error_message)) {
      error_message = res.error_message;
      break;
    }
    all_files.push(...res.file_list);
  }
  if (isValidNotEmptyString(error_message)) {
    item.json.request_valid = false;
    item.json.request_error_message = error_message;
    continue;
  }

  item.json.request_file_list = all_files;
  item.json.request_valid = true;
  item.json.request_error_message = '';
}

return $input.all();
