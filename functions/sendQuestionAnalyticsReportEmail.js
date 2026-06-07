// Deploy compatibility entrypoint for projects that resolve functionsDir from
// the repository root. The canonical implementation lives under base44/functions
// and this wrapper keeps functions.invoke("sendQuestionAnalyticsReportEmail")
// from serving an older flat-file handler.
import "../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts";
