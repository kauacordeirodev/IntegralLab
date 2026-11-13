const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let reply;
const context = vm.createContext({
  self: {postMessage: value => { reply = value; }},
  importScripts: (...names) => names.forEach(name => load(name))
});
function load(name) { vm.runInContext(fs.readFileSync('js/'+name,'utf8'), context, {filename:name}); }
load('worker.js');
const request = (options = {}) => {
  context.self.onmessage({data:{id:42,expression:'2x^2',a:0,b:2,n:10,method:'mid',...options}});
  assert.equal(reply.id,42);
  return reply.result;
};
const direct = request();
const reverse = request({a:2,b:0,convergence:true});
assert.ok(Math.abs(reverse.ref.value+16/3)<1e-9);
assert.equal(reverse.ref.area,direct.ref.area);
assert.ok(Math.abs(reverse.model.sum+direct.model.sum)<1e-9);
assert.equal(reverse.model.rows[0].x0,2);
assert.ok(reverse.model.rows[0].x1<2);
assert.equal(reverse.series.length,5);
assert.ok(Math.abs(request({a:2,b:0,method:'left'}).model.sum+request({method:'right'}).model.sum)<1e-9);
for (const expression of ['1/x','1/(x-0.1234567)','tan(x)']) {
  const pole = request({expression,a:2,b:-2});
  assert.equal(pole.ref,null);
  assert.equal(pole.model,null);
  assert.ok(pole.error);
}
assert.equal(request({n:100000}).ref,null);
assert.ok(request({expression:'1000000x',a:-1,b:1}).ref);
assert.equal(request({expression:'x^('}).model,null);
assert.ok(Math.abs(request({expression:'x',a:-2,b:2}).ref.area-4)<1e-9);
console.log('Worker: limites invertidos, métodos, convergência, singularidades, sintaxe e teto de subdivisões aprovados.');
