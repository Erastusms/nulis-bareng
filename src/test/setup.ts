import "@testing-library/jest-dom";

// In testing environment, disable live external Redis connections by default
process.env.ENABLE_REDIS = "false";
