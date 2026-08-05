package com.thangit.boardinghouse.config;

import com.thangit.boardinghouse.security.JwtAuthenticationFilter;
import com.thangit.boardinghouse.security.RestAccessDeniedHandler;
import com.thangit.boardinghouse.security.RestAuthenticationEntryPoint;
import com.thangit.boardinghouse.security.LoginRateLimitFilter;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableConfigurationProperties(AuthProperties.class)
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter,
            LoginRateLimitFilter loginRateLimitFilter,
            RestAuthenticationEntryPoint entryPoint, RestAccessDeniedHandler deniedHandler) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors.authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/v1/health").permitAll()
                        .requestMatchers("/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout",
                                "/api/auth/forgot-password", "/api/auth/reset-password").permitAll()
                        .requestMatchers("/api-docs", "/api-docs/**", "/swagger-ui.html", "/swagger-ui/**").permitAll()
                        .requestMatchers("/api/owner/**").hasRole("OWNER")
                        .requestMatchers("/api/manager/**").hasAnyRole("OWNER", "MANAGER")
                        .requestMatchers(HttpMethod.GET, "/api/admin/tenants/**")
                                .hasAnyRole("OWNER", "MANAGER", "ACCOUNTANT")
                        .requestMatchers(HttpMethod.GET, "/api/admin/properties/**", "/api/admin/rooms/**")
                                .hasAnyRole("OWNER", "MANAGER", "ACCOUNTANT")
                        .requestMatchers("/api/admin/invoices/**")
                                .hasAnyRole("OWNER", "MANAGER", "ACCOUNTANT")
                        .requestMatchers(HttpMethod.GET, "/api/admin/reports/**")
                                .hasAnyRole("OWNER", "MANAGER", "ACCOUNTANT", "TECHNICIAN")
                        .requestMatchers("/api/admin/reports/**")
                                .hasAnyRole("OWNER", "MANAGER", "ACCOUNTANT")
                        .requestMatchers("/api/admin/maintenance/**")
                                .hasAnyRole("OWNER", "MANAGER", "ACCOUNTANT")
                        .requestMatchers("/api/admin/**").hasAnyRole("OWNER", "MANAGER")
                        .requestMatchers("/api/accountant/**").hasRole("ACCOUNTANT")
                        .requestMatchers("/api/technician/**").hasRole("TECHNICIAN")
                        .requestMatchers("/api/tenant/**").hasRole("TENANT")
                        .anyRequest().authenticated())
                .addFilterBefore(loginRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    FilterRegistrationBean<LoginRateLimitFilter> loginRateLimitFilterRegistration(
            LoginRateLimitFilter filter) {
        FilterRegistrationBean<LoginRateLimitFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    FilterRegistrationBean<JwtAuthenticationFilter> jwtAuthenticationFilterRegistration(
            JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${app.cors.allowed-origins}") List<String> origins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Idempotency-Key"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
