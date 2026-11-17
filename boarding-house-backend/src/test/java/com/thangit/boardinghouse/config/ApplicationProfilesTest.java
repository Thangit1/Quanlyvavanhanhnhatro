package com.thangit.boardinghouse.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/** Loads configuration only; never starts a datasource or applies migrations. */
class ApplicationProfilesTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withPropertyValues(
                    "spring.config.location=classpath:/application.yml",
                    "DB_URL=jdbc:mysql://127.0.0.1:33307/profile_configuration_test",
                    "DB_USERNAME=profile_configuration_test",
                    "DB_PASSWORD=profile-test-only",
                    "JWT_SECRET=profile-test-only-secret-with-at-least-32-characters");

    @Test
    void localIncludesDevelopmentDatasource() {
        runner.withPropertyValues("spring.profiles.active=local").run(context -> {
            assertThat(context).hasNotFailed();
            var environment = context.getEnvironment();
            assertThat(environment.getActiveProfiles()).contains("local", "dev");
            assertThat(environment.getProperty("spring.datasource.url"))
                    .isEqualTo("jdbc:mysql://127.0.0.1:33307/profile_configuration_test");
            assertThat(environment.getProperty("spring.datasource.username"))
                    .isEqualTo("profile_configuration_test");
        });
    }

    @Test
    void defaultStillLoadsDevelopmentDatasource() {
        runner.withPropertyValues("spring.profiles.active=").run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getEnvironment().getDefaultProfiles()).contains("dev");
            assertThat(context.getEnvironment().getProperty("spring.datasource.url"))
                    .isEqualTo("jdbc:mysql://127.0.0.1:33307/profile_configuration_test");
        });
    }

    @Test
    void productionDoesNotActivateDevelopmentProfile() {
        runner.withPropertyValues("spring.profiles.active=prod").run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getEnvironment().getActiveProfiles())
                    .contains("prod").doesNotContain("dev", "local");
            assertThat(context.getEnvironment().getProperty("app.security.cookie.secure", Boolean.class))
                    .isTrue();
        });
    }
}
