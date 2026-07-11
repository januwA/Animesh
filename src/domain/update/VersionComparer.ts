/**
 * 比较两个语义化版本号 (Semantic Versioning)
 * @param v1 第一个版本号
 * @param v2 第二个版本号
 * @returns 如果 v1 > v2 返回 1，如果 v1 < v2 返回 -1，如果 v1 === v2 返回 0
 */
function compareReleaseSegments(
	segments1: string[],
	segments2: string[],
): number {
	const maxLength = Math.max(segments1.length, segments2.length);

	for (let i = 0; i < maxLength; i++) {
		const s1 = segments1[i] || "0";
		const s2 = segments2[i] || "0";

		const num1 = Number.parseInt(s1, 10);
		const num2 = Number.parseInt(s2, 10);

		if (Number.isNaN(num1) || Number.isNaN(num2)) {
			if (s1 > s2) return 1;
			if (s1 < s2) return -1;
		} else {
			if (num1 > num2) return 1;
			if (num1 < num2) return -1;
		}
	}
	return 0;
}

function comparePreRelease(pre1?: string, pre2?: string): number {
	if (pre1 && !pre2) {
		// 预发布版本（如 1.0.0-alpha）的优先级低于正式版本（如 1.0.0）
		return -1;
	}
	if (!pre1 && pre2) {
		return 1;
	}
	if (pre1 && pre2) {
		if (pre1 > pre2) return 1;
		if (pre1 < pre2) return -1;
	}
	return 0;
}

export function compareVersions(v1: string, v2: string): number {
	const cleanV1 = v1.replace(/^v/, "").trim();
	const cleanV2 = v2.replace(/^v/, "").trim();

	// 分割正式发布版本与预发布版本（例如 "1.0.0-alpha" -> ["1.0.0", "alpha"]）
	const [rel1, pre1] = cleanV1.split("-");
	const [rel2, pre2] = cleanV2.split("-");

	const relResult = compareReleaseSegments(rel1.split("."), rel2.split("."));
	if (relResult !== 0) return relResult;

	return comparePreRelease(pre1, pre2);
}
