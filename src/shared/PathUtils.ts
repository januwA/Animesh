/**
 * 提取路径模板中的参数名
 */
type ExtractParams<T extends string> =
	T extends `${string}:${infer Param}/${infer Rest}`
		? Param | ExtractParams<`/${Rest}`>
		: T extends `${string}:${infer Param}`
			? Param
			: never;

/**
 * 根据路径模板生成参数对象类型
 * 如果没有参数，则 args 数组为空
 * 如果有参数，则 args[0] 必须是对应的属性对象
 */
type PathParams<T extends string> = [ExtractParams<T>] extends [never]
	? []
	: [{ [K in ExtractParams<T>]: string | number }];

/**
 * 将带有占位符的 API 路径模板编译为真实的 URL (零依赖、强类型版本)
 *
 * @example
 * compilePath('/user/:id', { id: 123 }) => '/user/123'
 *
 * @param path API 路径模板
 * @param params 路径参数对象（受 TS 编译时校验）
 * @returns 编译后的路径字符串
 */
export function compilePath<P extends string>(
	path: P,
	...args: PathParams<P>
): string {
	const params = args[0];
	if (!params) {
		return path;
	}

	let result: string = path;
	for (const [key, value] of Object.entries(params)) {
		// 替换 :key 为真实值 (全局替换)
		// 示例: /agents/:agent_id -> /agents/123
		result = result.split(`:${key}`).join(encodeURIComponent(String(value)));
	}
	return result;
}
