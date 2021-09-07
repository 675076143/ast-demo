/**
 *
 *                  LISP                      C
 *
 *   2 + 2          (add 2 2)                 add(2, 2)
 *   4 - 2          (subtract 4 2)            subtract(4, 2)
 *   2 + (4 - 2)    (add 2 (subtract 4 2))    add(2, subtract(4, 2))
 *
 */

/**
 * 分词器
 * @param {*} input 字符串
 * @returns 分词结果
 */
function tokenizer(input) {
  let current = 0
  let tokens = []
  while (current < input.length) {
    let char = input[current]
    // 左括号的情况
    if (char === '(') {
      tokens.push({
        type: 'paren',
        value: '('
      })
      current++
      continue
    }
    // 右括号的情况
    if (char === ')') {
      tokens.push({
        type: 'paren',
        value: ')'
      })
      current++
      continue
    }
    // 空格直接跳过
    let WHITESPACE = /\s/
    if (WHITESPACE.test(char)) {
      current++
      continue
    }
    // 数字的情况
    let NUMBERS = /[0-9]/
    if (NUMBERS.test(char)) {
      let value = '';
      while (NUMBERS.test(char)) {
        value += char
        char = input[++current]
      }
      tokens.push({
        type: 'number',
        value
      })
      continue
    }
    // 字符串的情况
    if(char === '"'){
      let value = '';
      // 开头的双引号直接跳过
      char = input[++current]
      // 再次遇到双引号时即为字符串的终止
      while(char !== '"'){
        value += char
        char = input[++current]
      }
      // 结尾的终止符直接跳过
      char = input[++current]
      tokens.push({
        type: 'string',
        value
      })
    }
    // 关键字的情况
    let LETTERS = /[a-z]/i
    if(LETTERS.test(char)){
      let value = ''
      while(LETTERS.test(char)){
        value+=char
        char = input[++current]
      }
      tokens.push({
        type: 'name',
        value
      })
      continue
    }
    // 剩下的情况分词器不认, 直接抛错
    throw new TypeError('I dont know what this character is: ' + char)
  }
  return tokens
}

/**
 * 解析器
 * @param {*} tokens 分词列表
 * @returns AST抽象语法树
 */
function parser(tokens){
  let current = 0
  function walk(){
    let token = tokens[current]
    // 不同类型的token将进入不同的代码路径
    if(token.type === 'number') {
      current++;
      return {
        type: 'NumberLiteral',
        value: token.value
      }
    }
    if(token.type === 'string'){
      current++;
      return {
        type: 'StringLiteral',
        value: token.value
      }
    }
    if(token.type === 'paren' &&　token.value === '('){
      // 左括号直接跳过, AST不关心括号本身
      token = tokens[++current]
      let node = {
        type: 'CallExpression',
        name: token.value, // lisp中左括号之后跟着的是name, 这里就是name token
        params: [],
      }
      // 上文中CallExpression中已体现name token, 直接跳过
      token = tokens[++current];
      // 递归处理因括号引发的CallExpression
      while( (token.type !== 'paren') || (token === 'paren' && token !==')') ){
        node.params.push(walk())
        token = tokens[current]
      }
      // 同理，右括号直接跳过
      current++
      return node
    }
    // 其余类型的token解析器不认, 直接抛错
    throw new TypeError(token.type)
  }

  // 构建AST抽象语法树
  let ast = {
    type: 'Program',
    body: []
  }
  // 用循环执行walk, 使得CallExpression可以追加而不是嵌套
  while(current < tokens.length) {
    // 此处不需要自增current, 由walk函数控制, 当walk到底了, 再基于下一个token继续构建AST
    // 本质上是一个深度优先的算法
    ast.body.push(walk())
  }
  // 至此, ast构建完成
  return ast
}


/**
 *
 * 对于构建出来的AST来说拥有不同的节点（NumberLiteral/StringLiteral/CallExpression）
 * 对于不同的节点需要一个vistor去访问
 * {
 *   [Program/NumberLiteral/StringLiteral/CallExpression]: {
 *     enter(node,parent){},
 *     exit(node,parent){}
 *   }
 * }
 * 为了让vistor跑完每一个节点，需要一个遍历器
 */
/**
 * 遍历器
 * @param {*} ast 抽象语法树
 * @param {*} vistor 访问者
 */
function traverser(ast, vistor){
  function traverseArray(array, parent){
    array.forEach(child => {
      traverseNode(child, parent)
    })
  }
  function traverseNode(node, parent){
    // 先确定vistor是否有对应节点类型的处理法
    let methods = vistor[node.type]
    if(methods && methods.enter) {
      methods.enter(node, parent)
    }
    // 根据不同的节点类型做拆分
    switch(node.type) {
      case 'Program':
        traverseArray(node.body, node)
        break
      case 'CallExpression':
        traverseArray(node.params, node)
        break
      // NumberLiteral和StringLiteral节点都没有子节点，直接break
      case 'NumberLiteral':
      case 'StringLiteral':
        break
      // 不认识的节点类型直接抛错
      default:
        throw new TypeError(node.type)
    }
    // 如果有退出处理则执行
    if(methods && methods.exit) {
      methods.exit(node, parent)
    }
  }
  traverseNode(ast, null)
}


/**
 * AST转化器，将Lisp的AST转化为C的AST
 * ----------------------------------------------------------------------------
 *   Original AST                     |   Transformed AST
 * ----------------------------------------------------------------------------
 *   {                                |   {
 *     type: 'Program',               |     type: 'Program',
 *     body: [{                       |     body: [{
 *       type: 'CallExpression',      |       type: 'ExpressionStatement',
 *       name: 'add',                 |       expression: {
 *       params: [{                   |         type: 'CallExpression',
 *         type: 'NumberLiteral',     |         callee: {
 *         value: '2'                 |           type: 'Identifier',
 *       }, {                         |           name: 'add'
 *         type: 'CallExpression',    |         },
 *         name: 'subtract',          |         arguments: [{
 *         params: [{                 |           type: 'NumberLiteral',
 *           type: 'NumberLiteral',   |           value: '2'
 *           value: '4'               |         }, {
 *         }, {                       |           type: 'CallExpression',
 *           type: 'NumberLiteral',   |           callee: {
 *           value: '2'               |             type: 'Identifier',
 *         }]                         |             name: 'subtract'
 *       }]                           |           },
 *     }]                             |           arguments: [{
 *   }                                |             type: 'NumberLiteral',
 *                                    |             value: '4'
 * ---------------------------------- |           }, {
 *                                    |             type: 'NumberLiteral',
 *                                    |             value: '2'
 *                                    |           }]
 *  (sorry the other one is longer.)  |         }
 *                                    |       }
 *                                    |     }]
 *                                    |   }
 * ----------------------------------------------------------------------------
 * @param {*} ast Lisp的AST
 */
function transformer(ast){
  let newAst = {
    type: 'Program',
    body: []
  }
  // 黑魔法, 把新ast的body引用挂载在原ast上
  ast._context = newAst.body
  traverser(ast, {
    NumberLiteral: {
      enter(node,parent){
        parent._context.push({
          type: 'NumberLiteral',
          value: node.value
        })
      }
    },
    StringLiteral: {
      enter(node,parent){
        parent._context.push({
          type: 'StringLiteral',
          value: node.value
        })
      }
    },
    CallExpression: {
      enter(node,parent){
        // 循环创建CallExpression节点
        let expression = {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: node.name
          },
          arguments: []
        }
        node._context = expression.arguments
        if(parent.type !== 'CallExpression'){
          // 使用ExpressionStatement包装CallExpression节点
          // 原因: 顶层CallExpression在JavaScript是statements
          expression = {
            type: 'ExpressionStatement',
            expression
          }
        }
        parent._context.push(expression)
      }
    }
  })
  return newAst
}

/**
 * 生成代码
 * @param {*} node 节点
 */
function codeGenerator(node){
  // 根据不同的节点类型生成对应的代码段
  switch(node.type){
    case 'Program':
      // body中含有多个节点，将其分别解析并使用换行符分割
      return node.body.map(codeGenerator).join('\n')
    case 'ExpressionStatement':
      // 表达式末尾使用分号
      return `${codeGenerator(node.expression)};`
    case 'CallExpression':
      // 函数字面量+括号调用参数，多参数使用逗号分割
      return `${codeGenerator(node.callee)}(${node.arguments.map(codeGenerator).join(',')})`
    case 'Identifier':
      // 标识符直接返回对应标识符字面量
      return node.name
    case 'NumberLiteral':
      // 数字直接返回对应值
      return node.value
    case 'StringLiteral':
      // 字符串直接返回对应值,并在头尾拼上双引号
      return `"${node.value}"`
    default:
      throw new TypeError(node.type)
  }
}

/**
 * 编译器
 * 1. 输入 -> tokenizer -> 分词结果
 * 2. 分词结果 -> parser -> AST抽象语法树
 * 3. AST抽象语法树 -> transformer -> 新AST抽象语法树
 * 4. 新AST抽象语法树 -> generator -> 输出代码
 */
function compiler(input){
  let tokens = tokenizer(input)
  let ast = parser(tokens)
  let newAst = transformer(ast)
  let output = codeGenerator(newAst)
  return output
}

module.exports = {
  tokenizer,
  parser,
  traverser,
  transformer,
  codeGenerator,
  compiler,
};