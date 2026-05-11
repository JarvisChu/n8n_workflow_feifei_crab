# n8n_workflow_feifei_crab

肥肥蟹 (Feifei Crab) 的销售报表 → 发票生成 n8n workflow。

## 目录结构

```
.
├── n8n_node_parse_request.js     # n8n Code 节点：解析/校验 webhook 请求参数
├── n8n_node_create_invoices.js   # n8n Code 节点：解析 excel/csv，生成 invoice 与对应 HTML
│
├── main_parse_request.js         # 本地 runner：模拟 n8n 环境跑 parse_request 节点
├── main_create_invoices.js       # 本地 runner：模拟 n8n 环境跑 create_invoices 节点
│
├── request.json                  # parse_request 的本地调试输入（webhook 收到的请求 dump）
├── request_check_result.json     # parse_request 的本地输出
├── data_input.json               # create_invoices 的本地调试输入
├── data_output.json              # create_invoices 的本地输出
│
├── 验证数据/                      # 用于回归验证的输入数据
│   ├── data_input_202507.json    # create_invoices 验证数据
│   ├── data_input_202509.json
│   ├── request_202507.json       # parse_request 验证数据
│   └── request_202509.json
│
└── 附件/
    ├── 原始需求.pdf
    ├── 原始报表/                  # 客户上传的 excel/csv 原始文件
    └── 旧版本n8n代码/              # 历史版本的 n8n Code 节点（参考用）
        ├── n8n_node_create_html.js
        ├── n8n_node_process_feedme.js
        ├── n8n_node_process_tng.js
        └── n8n_node_process_merge.js
```

`n8n_node_xxx.js` 文件都是运行在 n8n Code 节点上的 javascript 代码。`for (const item of $input.all())` 是代码的入口，`$input` 在 n8n 环境里就是上游节点传过来的数据，`item.json` 是其中一条 item 的 payload。

## 当前处理范围

请求中的 `input.fields` 目前只处理：

- `feedme_excels` —— FEEDME 收款汇总表（每张对应一个门店）
- `product_sales_report_excels` —— Product Sales Report（与 FEEDME 一一对应）

> `tng_merchant_report_excel`（TNG Merchant Report）暂不处理：相关解析/汇总代码已在 `n8n_node_parse_request.js` 与 `n8n_node_create_invoices.js` 中注释保留，后续如需启用直接取消注释即可。`TOUCH N GO` 的金额当前直接取自 feedme 表对应的支付列。

支持同一 merchant 上传**多个月份**的报表，每个月单独生成一张 invoice：
- 唯一键为 `(merchant, 月份)`，因此同一 merchant 的多个月份 feedme/product_sales 不再视为重复。
- 每个 `(merchant, 月份)` 必须同时具备 feedme 和 product_sales 文件，否则报错。

## 本地运行

### parse_request

```bash
node main_parse_request.js                                # 默认 request.json -> request_check_result.json
node main_parse_request.js custom_input.json custom.json  # 自定义输入/输出
```

`main_parse_request.js` 会先把 `request.json` 中除 `headers / params / body / webhookUrl / executionMode` 之外的无关字段去掉，再交给节点代码处理，最终把检查结果写入 `request_check_result.json`。

### create_invoices

```bash
node main_create_invoices.js                              # 默认 data_input.json -> data_output.json
node main_create_invoices.js custom_input.json custom.json
```

`main_create_invoices.js` 会先按白名单（headers / params / query / body / webhookUrl / executionMode / request_user_id / request_organization_id / request_file_list / request_valid / request_error_message）清理 item 上的多余字段，再调用节点代码生成 invoice 数据和对应的 HTML，写入 `data_output.json`。

## 验证流程

每次修改对应的代码后，**必须**跑一遍 `验证数据/` 下相应的输入做回归验证。

### 修改了 `n8n_node_create_invoices.js` 或 `main_create_invoices.js`

```bash
for f in 验证数据/data_input_*.json; do
  node main_create_invoices.js "$f" /tmp/out.json
done
```

每张 invoice 输出后应当满足：

- `total_match === true`
- `total_diff === 0`

如果不满足，则视为**金额不匹配**（见下方约定）。

### 修改了 `n8n_node_parse_request.js` 或 `main_parse_request.js`

```bash
for f in 验证数据/request_*.json; do
  node main_parse_request.js "$f" /tmp/out.json
done
```

每条 item 输出后应当满足：

- `request_error_message === ''`（空字符串表示通过；非空表示具体错误）

## 约定

- 当我提到 **"金额不匹配"**，指的是某张 invoice 的 `total_match` 为 `false`、`total_diff` 不为 `0`。
  即 `grand_total !== total_payment`，账目对不上，需要排查。

## 关于 `total_match` 校验的含义

`total_match` 校验的是 `grand_total === total_payment`，**本质是对 feedme 表内部一致性的验证**。

代数推导（buckets 抵消、Tax Rounding 抵消 SST 替换、Rounding 抵消 product_sales 与 feedme 的 Gross/SC/Discount 差异后）：

```
grand_total - total_payment = F_items - P_feedme
```

其中：
- `F_items` = feedme summary 行 Nett 列**之前**所有 items 列的和（Gross + Discount + SST + SC + Other Charge + Delivery fee + Rounding）
- `P_feedme` = feedme summary 行 Nett 列**之后**所有 payment 列的和（AMEX + CASH + ... + VISA）

只要 feedme 报表自身账平（`F_items == P_feedme == feedme.Nett`），`total_match` 就是 true。所以这个校验真正在防的是：

1. feedme 报表本身数据不一致 / 漏算 / 错位
2. 我们解析时漏读了 column（如新出现的支付方式没归到 payment_list）
3. 后续代码改动破坏了 buckets / Tax Rounding / Rounding 公式中的某一项

不是装饰品，是有效的 sanity check。
