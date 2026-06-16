import { Transpiler } from 'ast-transpiler';
import log from 'ololog'

const csharpComments = {};

function transformLeadingComment(comment) {
    const commentNameRegex = /@name\s(\w+)#(\w+)/;
    const nameMatches = comment.match(commentNameRegex);
    const exchangeName = nameMatches ? nameMatches[1] : undefined;
    if (!exchangeName) {
        return comment;
    }
    const methodName = nameMatches[2];
    const commentDescriptionRegex = /@description\s(.+)/;
    const descriptionMatches = comment.match(commentDescriptionRegex);
    const description = descriptionMatches ? descriptionMatches[1] : undefined;
    const seeRegex = /@see\s(.+)/g;
    const seeMatches = comment.match(seeRegex);
    const sees = [];
    if (seeMatches) {
        seeMatches.forEach((match) => {
            const [, link] = match.split(' ');
            sees.push(link);
        });
    }
    const paramRegex = /@param\s{(\w+[?]?)}\s\[(\w+\.?\w+?)]\s(.+)/g;
    const params = [];
    let paramMatch;
    while ((paramMatch = paramRegex.exec(comment)) !== null) {
        const [, type, name, description] = paramMatch;
        params.push({ type, name, description });
    }
    const returnRegex = /@returns\s{(\w+\[?\]?\[?\]?)}\s(.+)/;
    const returnMatch = comment.match(returnRegex);
    const returnType = returnMatch ? returnMatch[1] : undefined;
    const returnDescription = returnMatch && returnMatch.length > 1 ? returnMatch[2] : undefined;

    let exchangeData = csharpComments[exchangeName];
    if (!exchangeData) {
        exchangeData = csharpComments[exchangeName] = {}
    }
    let exchangeMethods = csharpComments[exchangeName];
    if (!exchangeMethods) {
        exchangeMethods = {}
    }

    const comment2 = `/// <summary>\n    /// ${description}\n    /// </summary>\n    /// <remarks>\n    ${sees.map(l => `/// See <see href="${l}"/>  <br/>`).join("\n    ")}\n    /// <list type="table">\n    ${params.map(p => `/// <item>\n    /// <term>${p.name}</term>\n    /// <description>\n    /// ${p.type} : ${p.description}\n    /// </description>\n    /// </item>`).join("\n    ")}\n    /// </list>\n    /// </remarks>\n    /// <returns> <term>${returnType}</term> ${returnDescription}.</returns>`.replace(/^\s*[\r\n]/gm, "");

    exchangeMethods[methodName] = comment2;
    csharpComments[exchangeName] = exchangeMethods
    return comment;
}

export default async ({transpilerConfig, files}) => {
    // Clear comments from previous runs (for pool reuse)
    for (const key in csharpComments) {
        delete csharpComments[key];
    }

    const transpiler = new Transpiler(transpilerConfig);
    transpiler.csharpTranspiler.transformLeadingComment = transformLeadingComment;

    const result = [];
    for (const filePath of files) {
        log.blue('[worker][java] Transpiling', filePath);
        const transpiled = transpiler.transpileJavaByPath(filePath);
        result.push(transpiled);
    }
    return { results: result, comments: csharpComments };
}