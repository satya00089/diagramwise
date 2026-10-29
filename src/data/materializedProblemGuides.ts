import type { ProblemGuide } from "../types/problemGuide";
import guide0Data from "./public/problemGuides/build-a-big-data-processing-pipeline.json";
import guide1Data from "./public/problemGuides/build-a-climate-data-analysis-platform.json";
import guide2Data from "./public/problemGuides/build-a-cognitive-ai-application.json";
import guide3Data from "./public/problemGuides/build-a-global-gaming-backend-system.json";
import guide4Data from "./public/problemGuides/build-a-large-scale-data-migration-solution.json";
import guide5Data from "./public/problemGuides/build-a-machine-learning-model-deployment-pipeline.json";
import guide6Data from "./public/problemGuides/build-a-multi-cloud-kubernetes-orchestration-platform.json";
import guide7Data from "./public/problemGuides/build-a-real-time-analytics-dashboard.json";
import guide8Data from "./public/problemGuides/build-a-real-time-analytics-platform.json";
import guide9Data from "./public/problemGuides/build-a-real-time-data-streaming-pipeline.json";
import guide10Data from "./public/problemGuides/build-a-scalable-data-lake-architecture.json";
import guide11Data from "./public/problemGuides/build-a-secure-identity-management-solution-for-customers.json";
import guide12Data from "./public/problemGuides/serverless-event-driven-architecture.json";
import guide13Data from "./public/problemGuides/build-a-serverless-rest-api.json";
import guide14Data from "./public/problemGuides/build-a-virtual-desktop-infrastructure-solution.json";
import guide15Data from "./public/problemGuides/build-an-intelligent-document-processing-pipeline.json";
import guide17Data from "./public/problemGuides/count-facebook-likes-especially-for-high-profile-users.json";
import guide18Data from "./public/problemGuides/create-a-distributed-file-transfer-system-like-bittorrent.json";
import guide19Data from "./public/problemGuides/document-management-system.json";
import guide20Data from "./public/problemGuides/create-a-system-to-migrate-large-data-to-google-cloud.json";
import guide21Data from "./public/problemGuides/design-a-blockchain-network-solution.json";
import guide22Data from "./public/problemGuides/ci-cd-pipeline.json";
import guide23Data from "./public/problemGuides/design-a-compliance-and-audit-monitoring-solution.json";
import guide24Data from "./public/problemGuides/design-a-computer-vision-quality-inspection-system.json";
import guide25Data from "./public/problemGuides/design-a-confidential-computing-solution.json";
import guide26Data from "./public/problemGuides/design-a-container-based-microservices-architecture.json";
import guide27Data from "./public/problemGuides/design-a-control-plane-for-a-distributed-database.json";
import guide28Data from "./public/problemGuides/design-a-conversational-ai-platform-with-rag.json";
import guide29Data from "./public/problemGuides/design-a-credit-card-processing-system.json";
import guide30Data from "./public/problemGuides/design-a-credit-scoring-ml-pipeline.json";
import guide31Data from "./public/problemGuides/design-a-customer-churn-prediction-system.json";
import guide32Data from "./public/problemGuides/design-a-data-labeling-and-annotation-platform.json";
import guide33Data from "./public/problemGuides/design-a-data-pipeline-for-ml-with-data-quality-gates.json";
import guide34Data from "./public/problemGuides/design-a-demand-forecasting-system.json";
import guide35Data from "./public/problemGuides/design-a-distributed-botnet.json";
import guide36Data from "./public/problemGuides/design-a-distributed-metrics-logging-and-aggregation-system.json";
import guide37Data from "./public/problemGuides/design-a-distributed-model-training-platform.json";
import guide38Data from "./public/problemGuides/design-a-distributed-queue-like-rabbitmq.json";
import guide39Data from "./public/problemGuides/design-a-distributed-stream-processing-system-like-kafka.json";
import guide40Data from "./public/problemGuides/design-a-distributed-tracing-system.json";
import guide41Data from "./public/problemGuides/design-a-dynamic-pricing-engine.json";
import guide42Data from "./public/problemGuides/design-a-feature-store-for-machine-learning.json";
import guide43Data from "./public/problemGuides/design-a-file-downloader-library-from-frontend-to-backend.json";
import guide44Data from "./public/problemGuides/design-a-generative-ai-image-and-video-platform.json";
import guide45Data from "./public/problemGuides/design-a-global-content-delivery-network.json";
import guide46Data from "./public/problemGuides/design-a-gpu-cluster-management-system-for-ml-training.json";
import guide47Data from "./public/problemGuides/design-a-high-performance-computing-cluster.json";
import guide48Data from "./public/problemGuides/design-a-hotel-booking-system.json";
import guide49Data from "./public/problemGuides/design-a-hybrid-cloud-infrastructure-solution.json";
import guide50Data from "./public/problemGuides/design-a-job-scheduler.json";
import guide51Data from "./public/problemGuides/design-a-key-value-store.json";
import guide52Data from "./public/problemGuides/design-a-knowledge-graph-construction-and-query-system.json";
import guide53Data from "./public/problemGuides/design-a-large-language-model-serving-platform.json";
import guide54Data from "./public/problemGuides/design-a-live-comments-feature-for-facebook.json";
import guide55Data from "./public/problemGuides/design-a-log-anomaly-detection-system.json";
import guide56Data from "./public/problemGuides/design-a-machine-learning-platform.json";
import guide57Data from "./public/problemGuides/design-a-model-registry-and-versioning-system.json";
import guide58Data from "./public/problemGuides/design-a-model-serving-infrastructure-with-canary-deployments.json";
import guide59Data from "./public/problemGuides/design-a-multi-cloud-data-sync-solution.json";
import guide60Data from "./public/problemGuides/design-a-multi-modal-ai-assistant.json";
import guide61Data from "./public/problemGuides/design-a-multi-region-disaster-recovery-solution.json";
import guide62Data from "./public/problemGuides/design-a-natural-language-processing-pipeline.json";
import guide63Data from "./public/problemGuides/recommendation-engine.json";
import guide64Data from "./public/problemGuides/design-a-predictive-auto-scaling-system.json";
import guide65Data from "./public/problemGuides/design-a-predictive-maintenance-system.json";
import guide66Data from "./public/problemGuides/design-a-real-time-ai-content-moderation-system.json";
import guide67Data from "./public/problemGuides/design-a-real-time-ai-translation-and-localization-service.json";
import guide68Data from "./public/problemGuides/design-a-real-time-gaming-leaderboard-system.json";
import guide69Data from "./public/problemGuides/design-a-real-time-model-monitoring-and-drift-detection-system.json";
import guide70Data from "./public/problemGuides/real-time-recommendation-system.json";
import guide71Data from "./public/problemGuides/design-a-real-time-sentiment-analysis-platform.json";
import guide72Data from "./public/problemGuides/design-a-reinforcement-learning-trading-system.json";
import guide73Data from "./public/problemGuides/design-a-scalable-e-commerce-backend.json";
import guide74Data from "./public/problemGuides/design-a-scalable-global-web-application.json";
import guide75Data from "./public/problemGuides/design-a-scalable-iot-platform.json";
import guide76Data from "./public/problemGuides/design-a-secure-multi-cloud-kubernetes-architecture.json";
import guide77Data from "./public/problemGuides/design-a-secure-multi-tier-web-application.json";
import guide78Data from "./public/problemGuides/design-a-self-healing-infrastructure-platform.json";
import guide79Data from "./public/problemGuides/design-a-smart-sla-monitoring-and-prediction-system.json";
import guide80Data from "./public/problemGuides/design-a-system-to-monitor-the-health-of-a-cluster.json";
import guide81Data from "./public/problemGuides/design-a-system-to-view-latest-stock-prices-worldwide.json";
import guide82Data from "./public/problemGuides/design-a-user-login-and-authentication-system.json";
import guide83Data from "./public/problemGuides/video-transcoding-pipeline.json";
import guide84Data from "./public/problemGuides/design-an-a-b-testing-framework-for-ml-models.json";
import guide85Data from "./public/problemGuides/design-an-a-b-testing-system.json";
import guide86Data from "./public/problemGuides/design-an-ai-based-real-time-fraud-detection-system.json";
import guide87Data from "./public/problemGuides/design-an-ai-driven-change-risk-assessment-system.json";
import guide88Data from "./public/problemGuides/design-an-ai-powered-alert-correlation-and-noise-reduction-system.json";
import guide89Data from "./public/problemGuides/design-an-ai-powered-cloud-cost-optimization-platform.json";
import guide90Data from "./public/problemGuides/design-an-ai-powered-code-assistant.json";
import guide91Data from "./public/problemGuides/design-an-ai-powered-contact-center-solution.json";
import guide92Data from "./public/problemGuides/design-an-ai-powered-legal-document-analysis-platform.json";
import guide93Data from "./public/problemGuides/design-an-ai-powered-medical-diagnosis-assistant.json";
import guide94Data from "./public/problemGuides/semantic-search-engine.json";
import guide95Data from "./public/problemGuides/design-an-anomaly-detection-system-for-time-series-data.json";
import guide96Data from "./public/problemGuides/design-an-api-rate-limiter.json";
import guide97Data from "./public/problemGuides/design-an-automated-chaos-engineering-platform.json";
import guide98Data from "./public/problemGuides/design-an-automated-model-retraining-pipeline.json";
import guide99Data from "./public/problemGuides/design-an-automated-root-cause-analysis-platform.json";
import guide100Data from "./public/problemGuides/design-an-autonomous-vehicle-perception-system.json";
import guide101Data from "./public/problemGuides/design-an-end-to-end-ml-pipeline-orchestration-platform.json";
import guide102Data from "./public/problemGuides/design-an-enterprise-data-warehouse-solution.json";
import guide103Data from "./public/problemGuides/eta-location-sharing.json";
import guide104Data from "./public/problemGuides/design-an-intelligent-capacity-planning-system.json";
import guide105Data from "./public/problemGuides/design-an-intelligent-incident-management-system.json";
import guide106Data from "./public/problemGuides/observability-platform.json";
import guide107Data from "./public/problemGuides/design-an-ioc-dependency-injection-framework.json";
import guide108Data from "./public/problemGuides/design-an-ml-experiment-tracking-system.json";
import guide109Data from "./public/problemGuides/design-an-on-call-escalation-system.json";
import guide110Data from "./public/problemGuides/design-and-implement-a-wire-transfer-api.json";
import guide111Data from "./public/problemGuides/design-backend-for-an-app-to-distribute-6-million-free-burgers-in-one-hour.json";
import guide112Data from "./public/problemGuides/design-google-analytics-user-analytics-dashboard-and-pipeline.json";
import guide113Data from "./public/problemGuides/google-calendar-system-design.json";
import guide114Data from "./public/problemGuides/twitter-system-design.json";
import guide115Data from "./public/problemGuides/design-typeahead-suggestion-autocomplete.json";
import guide116Data from "./public/problemGuides/web-crawler.json";
import guide117Data from "./public/problemGuides/design-yelp-or-nearby-friends.json";
import guide118Data from "./public/problemGuides/develop-a-photo-sharing-platform-like-flickr-or-google-photos.json";
import guide119Data from "./public/problemGuides/develop-a-weather-application.json";
import guide120Data from "./public/problemGuides/develop-an-ads-management-and-display-system-for-a-social-feed.json";
import guide121Data from "./public/problemGuides/payment-system.json";
import guide122Data from "./public/problemGuides/distributed-cache.json";
import guide124Data from "./public/problemGuides/distributed-file-storage.json";
import guide126Data from "./public/problemGuides/uber-rider-matching.json";
import guide129Data from "./public/problemGuides/identify-the-k-most-shared-articles-in-various-time-windows.json";
import guide131Data from "./public/problemGuides/netflix-concurrent-stream-limits.json";
import guide132Data from "./public/problemGuides/notification-system.json";
import guide138Data from "./public/problemGuides/real-time-chat-system.json";
import guide141Data from "./public/problemGuides/ride-sharing-system.json";
import guide145Data from "./public/problemGuides/social-media-news-feed.json";
import guide146Data from "./public/problemGuides/surge-pricing-system-uber-stream-processing.json";
import guide147Data from "./public/problemGuides/system-to-collect-performance-metrics-from-thousands-of-servers.json";
import guide148Data from "./public/problemGuides/top-k-ranking-system.json";
import guide150Data from "./public/problemGuides/url-shortener-like-bit-ly.json";
import guide151Data from "./public/problemGuides/video-streaming-platform.json";
import guide154Data from "./public/problemGuides/web-search-engine.json";

export const materializedProblemGuides: Record<string, ProblemGuide> = {
  "build-a-big-data-processing-pipeline": guide0Data as ProblemGuide,
  "build-a-climate-data-analysis-platform": guide1Data as ProblemGuide,
  "build-a-cognitive-ai-application": guide2Data as ProblemGuide,
  "build-a-global-gaming-backend-system": guide3Data as ProblemGuide,
  "build-a-large-scale-data-migration-solution": guide4Data as ProblemGuide,
  "build-a-machine-learning-model-deployment-pipeline":
    guide5Data as ProblemGuide,
  "build-a-multi-cloud-kubernetes-orchestration-platform":
    guide6Data as ProblemGuide,
  "build-a-real-time-analytics-dashboard": guide7Data as ProblemGuide,
  "build-a-real-time-analytics-platform": guide8Data as ProblemGuide,
  "build-a-real-time-data-streaming-pipeline": guide9Data as ProblemGuide,
  "build-a-scalable-data-lake-architecture": guide10Data as ProblemGuide,
  "build-a-secure-identity-management-solution-for-customers":
    guide11Data as ProblemGuide,
  "serverless-event-driven-architecture": guide12Data as ProblemGuide,
  "build-a-serverless-rest-api": guide13Data as ProblemGuide,
  "build-a-virtual-desktop-infrastructure-solution":
    guide14Data as ProblemGuide,
  "build-an-intelligent-document-processing-pipeline":
    guide15Data as ProblemGuide,
  "count-facebook-likes-especially-for-high-profile-users":
    guide17Data as ProblemGuide,
  "create-a-distributed-file-transfer-system-like-bittorrent":
    guide18Data as ProblemGuide,
  "document-management-system": guide19Data as ProblemGuide,
  "create-a-system-to-migrate-large-data-to-google-cloud":
    guide20Data as ProblemGuide,
  "design-a-blockchain-network-solution": guide21Data as ProblemGuide,
  "ci-cd-pipeline": guide22Data as ProblemGuide,
  "design-a-compliance-and-audit-monitoring-solution":
    guide23Data as ProblemGuide,
  "design-a-computer-vision-quality-inspection-system":
    guide24Data as ProblemGuide,
  "design-a-confidential-computing-solution": guide25Data as ProblemGuide,
  "design-a-container-based-microservices-architecture":
    guide26Data as ProblemGuide,
  "design-a-control-plane-for-a-distributed-database":
    guide27Data as ProblemGuide,
  "design-a-conversational-ai-platform-with-rag": guide28Data as ProblemGuide,
  "design-a-credit-card-processing-system": guide29Data as ProblemGuide,
  "design-a-credit-scoring-ml-pipeline": guide30Data as ProblemGuide,
  "design-a-customer-churn-prediction-system": guide31Data as ProblemGuide,
  "design-a-data-labeling-and-annotation-platform": guide32Data as ProblemGuide,
  "design-a-data-pipeline-for-ml-with-data-quality-gates":
    guide33Data as ProblemGuide,
  "design-a-demand-forecasting-system": guide34Data as ProblemGuide,
  "design-a-distributed-botnet": guide35Data as ProblemGuide,
  "design-a-distributed-metrics-logging-and-aggregation-system":
    guide36Data as ProblemGuide,
  "design-a-distributed-model-training-platform": guide37Data as ProblemGuide,
  "design-a-distributed-queue-like-rabbitmq": guide38Data as ProblemGuide,
  "design-a-distributed-stream-processing-system-like-kafka":
    guide39Data as ProblemGuide,
  "design-a-distributed-tracing-system": guide40Data as ProblemGuide,
  "design-a-dynamic-pricing-engine": guide41Data as ProblemGuide,
  "design-a-feature-store-for-machine-learning": guide42Data as ProblemGuide,
  "design-a-file-downloader-library-from-frontend-to-backend":
    guide43Data as ProblemGuide,
  "design-a-generative-ai-image-and-video-platform":
    guide44Data as ProblemGuide,
  "design-a-global-content-delivery-network": guide45Data as ProblemGuide,
  "design-a-gpu-cluster-management-system-for-ml-training":
    guide46Data as ProblemGuide,
  "design-a-high-performance-computing-cluster": guide47Data as ProblemGuide,
  "design-a-hotel-booking-system": guide48Data as ProblemGuide,
  "design-a-hybrid-cloud-infrastructure-solution": guide49Data as ProblemGuide,
  "design-a-job-scheduler": guide50Data as ProblemGuide,
  "design-a-key-value-store": guide51Data as ProblemGuide,
  "design-a-knowledge-graph-construction-and-query-system":
    guide52Data as ProblemGuide,
  "design-a-large-language-model-serving-platform": guide53Data as ProblemGuide,
  "design-a-live-comments-feature-for-facebook": guide54Data as ProblemGuide,
  "design-a-log-anomaly-detection-system": guide55Data as ProblemGuide,
  "design-a-machine-learning-platform": guide56Data as ProblemGuide,
  "design-a-model-registry-and-versioning-system": guide57Data as ProblemGuide,
  "design-a-model-serving-infrastructure-with-canary-deployments":
    guide58Data as ProblemGuide,
  "design-a-multi-cloud-data-sync-solution": guide59Data as ProblemGuide,
  "design-a-multi-modal-ai-assistant": guide60Data as ProblemGuide,
  "design-a-multi-region-disaster-recovery-solution":
    guide61Data as ProblemGuide,
  "design-a-natural-language-processing-pipeline": guide62Data as ProblemGuide,
  "recommendation-engine": guide63Data as ProblemGuide,
  "design-a-predictive-auto-scaling-system": guide64Data as ProblemGuide,
  "design-a-predictive-maintenance-system": guide65Data as ProblemGuide,
  "design-a-real-time-ai-content-moderation-system":
    guide66Data as ProblemGuide,
  "design-a-real-time-ai-translation-and-localization-service":
    guide67Data as ProblemGuide,
  "design-a-real-time-gaming-leaderboard-system": guide68Data as ProblemGuide,
  "design-a-real-time-model-monitoring-and-drift-detection-system":
    guide69Data as ProblemGuide,
  "real-time-recommendation-system": guide70Data as ProblemGuide,
  "design-a-real-time-sentiment-analysis-platform": guide71Data as ProblemGuide,
  "design-a-reinforcement-learning-trading-system": guide72Data as ProblemGuide,
  "design-a-scalable-e-commerce-backend": guide73Data as ProblemGuide,
  "design-a-scalable-global-web-application": guide74Data as ProblemGuide,
  "design-a-scalable-iot-platform": guide75Data as ProblemGuide,
  "design-a-secure-multi-cloud-kubernetes-architecture":
    guide76Data as ProblemGuide,
  "design-a-secure-multi-tier-web-application": guide77Data as ProblemGuide,
  "design-a-self-healing-infrastructure-platform": guide78Data as ProblemGuide,
  "design-a-smart-sla-monitoring-and-prediction-system":
    guide79Data as ProblemGuide,
  "design-a-system-to-monitor-the-health-of-a-cluster":
    guide80Data as ProblemGuide,
  "design-a-system-to-view-latest-stock-prices-worldwide":
    guide81Data as ProblemGuide,
  "design-a-user-login-and-authentication-system": guide82Data as ProblemGuide,
  "video-transcoding-pipeline": guide83Data as ProblemGuide,
  "design-an-a-b-testing-framework-for-ml-models": guide84Data as ProblemGuide,
  "design-an-a-b-testing-system": guide85Data as ProblemGuide,
  "design-an-ai-based-real-time-fraud-detection-system":
    guide86Data as ProblemGuide,
  "design-an-ai-driven-change-risk-assessment-system":
    guide87Data as ProblemGuide,
  "design-an-ai-powered-alert-correlation-and-noise-reduction-system":
    guide88Data as ProblemGuide,
  "design-an-ai-powered-cloud-cost-optimization-platform":
    guide89Data as ProblemGuide,
  "design-an-ai-powered-code-assistant": guide90Data as ProblemGuide,
  "design-an-ai-powered-contact-center-solution": guide91Data as ProblemGuide,
  "design-an-ai-powered-legal-document-analysis-platform":
    guide92Data as ProblemGuide,
  "design-an-ai-powered-medical-diagnosis-assistant":
    guide93Data as ProblemGuide,
  "semantic-search-engine": guide94Data as ProblemGuide,
  "design-an-anomaly-detection-system-for-time-series-data":
    guide95Data as ProblemGuide,
  "design-an-api-rate-limiter": guide96Data as ProblemGuide,
  "design-an-automated-chaos-engineering-platform": guide97Data as ProblemGuide,
  "design-an-automated-model-retraining-pipeline": guide98Data as ProblemGuide,
  "design-an-automated-root-cause-analysis-platform":
    guide99Data as ProblemGuide,
  "design-an-autonomous-vehicle-perception-system":
    guide100Data as ProblemGuide,
  "design-an-end-to-end-ml-pipeline-orchestration-platform":
    guide101Data as ProblemGuide,
  "design-an-enterprise-data-warehouse-solution": guide102Data as ProblemGuide,
  "eta-location-sharing": guide103Data as ProblemGuide,
  "design-an-intelligent-capacity-planning-system":
    guide104Data as ProblemGuide,
  "design-an-intelligent-incident-management-system":
    guide105Data as ProblemGuide,
  "observability-platform": guide106Data as ProblemGuide,
  "design-an-ioc-dependency-injection-framework": guide107Data as ProblemGuide,
  "design-an-ml-experiment-tracking-system": guide108Data as ProblemGuide,
  "design-an-on-call-escalation-system": guide109Data as ProblemGuide,
  "design-and-implement-a-wire-transfer-api": guide110Data as ProblemGuide,
  "design-backend-for-an-app-to-distribute-6-million-free-burgers-in-one-hour":
    guide111Data as ProblemGuide,
  "design-google-analytics-user-analytics-dashboard-and-pipeline":
    guide112Data as ProblemGuide,
  "google-calendar-system-design": guide113Data as ProblemGuide,
  "twitter-system-design": guide114Data as ProblemGuide,
  "design-typeahead-suggestion-autocomplete": guide115Data as ProblemGuide,
  "web-crawler": guide116Data as ProblemGuide,
  "design-yelp-or-nearby-friends": guide117Data as ProblemGuide,
  "develop-a-photo-sharing-platform-like-flickr-or-google-photos":
    guide118Data as ProblemGuide,
  "develop-a-weather-application": guide119Data as ProblemGuide,
  "develop-an-ads-management-and-display-system-for-a-social-feed":
    guide120Data as ProblemGuide,
  "payment-system": guide121Data as ProblemGuide,
  "distributed-cache": guide122Data as ProblemGuide,
  "distributed-file-storage": guide124Data as ProblemGuide,
  "uber-rider-matching": guide126Data as ProblemGuide,
  "identify-the-k-most-shared-articles-in-various-time-windows":
    guide129Data as ProblemGuide,
  "netflix-concurrent-stream-limits": guide131Data as ProblemGuide,
  "notification-system": guide132Data as ProblemGuide,
  "real-time-chat-system": guide138Data as ProblemGuide,
  "ride-sharing-system": guide141Data as ProblemGuide,
  "social-media-news-feed": guide145Data as ProblemGuide,
  "surge-pricing-system-uber-stream-processing": guide146Data as ProblemGuide,
  "system-to-collect-performance-metrics-from-thousands-of-servers":
    guide147Data as ProblemGuide,
  "top-k-ranking-system": guide148Data as ProblemGuide,
  "url-shortener-like-bit-ly": guide150Data as ProblemGuide,
  "video-streaming-platform": guide151Data as ProblemGuide,
  "web-search-engine": guide154Data as ProblemGuide,
};
