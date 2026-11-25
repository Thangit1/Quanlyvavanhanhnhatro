FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace
COPY . .
RUN --mount=type=cache,target=/root/.m2 chmod +x mvnw && ./mvnw -B -ntp -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /workspace/target/boarding-house-backend-*-exec.jar app.jar
RUN addgroup -S smarthome && adduser -S -G smarthome smarthome \
    && mkdir -p /var/lib/smarthome/property-images \
    && chown smarthome:smarthome /var/lib/smarthome/property-images
USER smarthome
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
