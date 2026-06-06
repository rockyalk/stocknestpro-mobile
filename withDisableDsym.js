const { withXcodeProject } = require('@expo/config-plugins');

module.exports = function withDisableDsym(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const buildConfigurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in buildConfigurations) {
      if (!buildConfigurations[key].buildSettings) continue;
      buildConfigurations[key].buildSettings.DEBUG_INFORMATION_FORMAT = 'dwarf';
    }
    return config;
  });
};
