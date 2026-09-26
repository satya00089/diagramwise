// Google Identity Services TypeScript declarations
interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleButtonConfig {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback?: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  prompt_parent_id?: string;
  nonce?: string;
  context?: "signin" | "signup" | "use";
  state_cookie_domain?: string;
  ux_mode?: "popup" | "redirect";
  login_uri?: string;
  allowed_parent_origin?: string | string[];
  intermediate_iframe_close_callback?: () => void;
}

interface GoogleAccounts {
  id: {
    initialize: (config: GoogleIdConfiguration) => void;
    prompt: (
      momentListener?: (notification: PromptMomentNotification) => void,
    ) => void;
    renderButton: (
      parent: HTMLElement | null,
      options: GoogleButtonConfig,
    ) => void;
    disableAutoSelect: () => void;
    storeCredential: (
      credential: { id: string; password: string },
      callback?: () => void,
    ) => void;
    cancel: () => void;
    revoke: (
      hint: string,
      callback?: (done: RevokeDoneResponse) => void,
    ) => void;
  };
}

interface PromptMomentNotification {
  isDisplayMoment: () => boolean;
  isDisplayed: () => boolean;
  isNotDisplayed: () => boolean;
  getNotDisplayedReason: () => string;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getDismissedReason: () => string;
  getMomentType: () => string;
}

interface RevokeDoneResponse {
  successful: boolean;
  error?: string;
}

interface Window {
  google?: {
    accounts: GoogleAccounts;
  };
}
